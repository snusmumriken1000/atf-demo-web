/*
 * ビルド成果物(build/)の静的検証。Node 標準モジュールのみ使用。
 *
 * 検証内容:
 *   1. 3 ページ(index.html / showcase.html / profile.html)が存在すること
 *   2. 3 ページが内部リンクで相互に到達可能であること(リンクグラフ)
 *   3. 外部 URL 参照がないこと(default-deny + 許容リスト方式)
 *
 * 3 は build/ 配下の html / css / js / svg を再帰走査し、外部 URL らしき
 * 文字列(http(s):// およびプロトコル相対 //host/…)をすべて違反とする。
 * 許容するのは次の 3 つのみ:
 *   (1) <a href> / <area href> の外部ハイパーリンク(仕様上許可されている)
 *   (2) 属性名 xmlns / xmlns:* の名前空間宣言(識別子であり通信しない)
 *   (3) ALLOWED_URL_PREFIXES に載ったプレフィックス(根拠コメント必須)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import process from 'node:process';

const buildDir = join(process.cwd(), 'build');

// 通信を発生させないことが確認済みの URL プレフィックス。
// 追加する場合は「なぜ通信しないか」のコメントを必ず添えること。
const ALLOWED_URL_PREFIXES = [
	// Svelte ランタイムのエラーメッセージに含まれるドキュメントへのリンク。
	// console 出力用の文字列であり、fetch 等で読み込まれることはない
	'https://svelte.dev/e/',
	// XML 名前空間 URI(SVG / XHTML)。createElementNS 等の識別子として
	// 使われるだけで、URL として通信することはない
	'http://www.w3.org/'
];

// ページ名 → 出力ファイルの対応(adapter-static のデフォルト出力)
const pages = {
	'/': 'index.html',
	'/showcase': 'showcase.html',
	'/profile': 'profile.html'
};

// 外部 URL 検査の対象拡張子(version.json / robots.txt 等は対象外)
const SCAN_EXTENSIONS = new Set(['.html', '.css', '.js', '.svg']);

const errors = [];

// --- 共通ヘルパー -------------------------------------------------------

const isAllowedByPrefix = (url) => ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));

// <a href> / <area href> の外部ハイパーリンクだけは仕様上許可される
const isHyperlink = (tagName, attrName) =>
	(tagName === 'a' || tagName === 'area') && attrName === 'href';

const reportUrl = (file, context, url) => {
	if (!isAllowedByPrefix(url)) {
		errors.push(`外部 URL 参照: ${file} の ${context} → ${url}`);
	}
};

// --- 走査ロジック(HTML / CSS / JS / SVG) ------------------------------

// 属性値から外部 URL 候補を抽出する
function* extractAttrUrls(value) {
	// 絶対 URL は値のどこに現れても検出する(meta refresh の url=… 等に対応)
	for (const match of value.matchAll(/https?:\/\/[^\s,'"<>]+/gi)) yield match[0];
	// プロトコル相対 URL(//host/…)は値の先頭・空白・カンマの直後のみ検出する
	// (srcset の候補区切りに対応しつつ、パス中の // を誤検出しないため)
	for (const match of value.matchAll(/(?:^|[\s,])(\/\/[^\s,'"<>]+)/g)) yield match[1];
}

// CSS(*.css / <style> ブロック / style 属性)から URL を抽出して検査する。
// 相対パスと data: URI は外部 URL の形に一致しないため自然に許容される
function scanCss(css, file, context) {
	const urls = [];
	// url(...) — 引用符あり / なしの両形式
	for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s][^)]*))\s*\)/gi)) {
		urls.push((match[1] ?? match[2] ?? match[3]).trim());
	}
	// @import の文字列形式(url() 形式は上でカバー済み)
	for (const match of css.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) {
		urls.push(match[1] ?? match[2]);
	}
	// image-set() 内の文字列形式 URL(url() 形式は上でカバー済み)
	for (const match of css.matchAll(/image-set\(([^)]*)\)/gi)) {
		for (const str of match[1].matchAll(/"([^"]*)"|'([^']*)'/g)) {
			urls.push(str[1] ?? str[2]);
		}
	}
	for (const url of urls) {
		if (/^(https?:)?\/\//i.test(url)) reportUrl(file, context, url);
	}
}

// JS(*.js / インライン <script>)を検査する。
//   - 絶対 URL(https?://…)はソース中のどこに現れても検出する
//     (文字列の途中・連結・コメント内も対象。default-deny 側に倒す)
//   - プロトコル相対 URL(//host/…)はコメントと区別が付かないため、
//     文字列リテラル文脈(" ' ` の直後)の「ドットを含むホスト形」のみ検出する
function scanJs(source, file, context) {
	for (const match of source.matchAll(/https?:\/\/[^\s"'`<>\\)]+/gi)) {
		reportUrl(file, context, match[0]);
	}
	const literalRelative = /["'`](\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s"'`\\]*)/gi;
	for (const match of source.matchAll(literalRelative)) {
		reportUrl(file, context, match[1]);
	}
}

// HTML / SVG のマークアップを走査する。<style> の中身は CSS、インライン
// <script> の中身は JS として検査し、残りは全タグの全属性を検査する
function scanMarkup(source, file) {
	let rest = source.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
		scanCss(css, file, '<style> ブロック');
		return '';
	});
	rest = rest.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_, attrs, body) => {
		scanJs(body, file, 'インライン <script>');
		// タグ自体の属性(src 等)は残して属性走査で検査する
		return `<script${attrs}></script>`;
	});
	for (const tag of rest.matchAll(/<([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g)) {
		const tagName = tag[1].toLowerCase();
		// 属性値は引用符あり(" ')に加え、引用符なし(unquoted)形式にも対応する
		for (const attr of tag[2].matchAll(
			/([^\s=/'"<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
		)) {
			const attrName = attr[1].toLowerCase();
			const value = attr[2] ?? attr[3] ?? attr[4];
			// 許容 (1): 外部サイトへのハイパーリンク
			if (isHyperlink(tagName, attrName)) continue;
			// 許容 (2): 名前空間宣言(通信しない識別子)
			if (attrName === 'xmlns' || attrName.startsWith('xmlns:')) continue;
			if (attrName === 'style') {
				scanCss(value, file, `<${tagName}> の style 属性`);
				continue;
			}
			for (const url of extractAttrUrls(value)) {
				reportUrl(file, `<${tagName} ${attrName}>`, url);
			}
		}
	}
}

// build/ 配下を再帰走査して検査対象ファイルの一覧を返す
function collectFiles(dir) {
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectFiles(path));
		} else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
			files.push(path);
		}
	}
	return files;
}

// --- 1. 存在確認 --------------------------------------------------------

const html = {};
for (const [route, file] of Object.entries(pages)) {
	const path = join(buildDir, file);
	if (!existsSync(path)) {
		errors.push(`ページが出力されていません: ${file}(${route})`);
		continue;
	}
	html[route] = readFileSync(path, 'utf8');
}

if (errors.length === 0) {
	// --- 2. 相互到達性(リンクグラフ) ------------------------------------

	// href を既知のルートに正規化する。プリレンダリング出力は相対パス
	// (./showcase など)になるため、ページの出力ファイル位置を基準に解決する
	const normalize = (href, file) => {
		if (href.startsWith('#')) return null;
		const base = new URL(file, 'https://local/');
		const url = new URL(href, base);
		// 絶対 URL・プロトコル相対 URL(//host/…)など外部オリジンは内部リンクとして扱わない
		if (url.origin !== base.origin) return null;
		const path =
			url.pathname.length > 1 && url.pathname.endsWith('/')
				? url.pathname.slice(0, -1)
				: url.pathname;
		return path in pages ? path : null;
	};

	const graph = {};
	for (const [route, source] of Object.entries(html)) {
		const targets = new Set();
		for (const match of source.matchAll(/<a\s[^>]*href="([^"]*)"/g)) {
			const target = normalize(match[1], pages[route]);
			if (target && target !== route) targets.add(target);
		}
		graph[route] = targets;
	}

	// 各ページを起点に BFS し、他の全ページへ到達できるか確認する
	for (const start of Object.keys(pages)) {
		const visited = new Set([start]);
		const queue = [start];
		while (queue.length > 0) {
			for (const next of graph[queue.shift()]) {
				if (!visited.has(next)) {
					visited.add(next);
					queue.push(next);
				}
			}
		}
		for (const route of Object.keys(pages)) {
			if (!visited.has(route)) {
				errors.push(`リンクグラフ: ${start} から ${route} へ到達できません`);
			}
		}
	}
}

// --- 3. 外部 URL 参照の検出(default-deny) -----------------------------

if (existsSync(buildDir)) {
	for (const path of collectFiles(buildDir)) {
		const file = relative(buildDir, path);
		const source = readFileSync(path, 'utf8');
		const ext = extname(path);
		if (ext === '.html' || ext === '.svg') {
			scanMarkup(source, file);
		} else if (ext === '.css') {
			scanCss(source, file, 'CSS');
		} else if (ext === '.js') {
			scanJs(source, file, 'JS 文字列リテラル');
		}
	}
}

if (errors.length > 0) {
	console.error('check-static: NG');
	for (const error of errors) console.error(`  - ${error}`);
	if (errors.some((error) => error.startsWith('外部 URL 参照'))) {
		console.error(
			'  ※ 通信しない URL の誤検出であれば、scripts/check-static.mjs の' +
				' ALLOWED_URL_PREFIXES に根拠コメント付きで追加してください'
		);
	}
	process.exit(1);
}

console.log('check-static: OK(3 ページの存在・相互到達性・外部 URL 参照なしを確認)');
