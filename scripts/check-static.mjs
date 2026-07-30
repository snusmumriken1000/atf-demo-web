/*
 * ビルド成果物(build/)の簡易静的検証。Node 標準モジュールのみ使用。
 *
 * 検証内容:
 *   1. 3 ページ(index.html / showcase.html / profile.html)が存在すること
 *   2. 3 ページが内部リンクで相互に到達可能であること(リンクグラフ)
 *   3. <link> / <script src> / <img src> / <img srcset> に外部 URL
 *      (http(s) およびプロトコル相対 //host/…)がないこと
 *      (外部サイトへのハイパーリンク <a href> は許可されるため除外)
 *
 * 本格的な検証(HTML パーサ・全アセット走査・Lighthouse 等)は #5 の担当。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const buildDir = join(process.cwd(), 'build');

// ページ名 → 出力ファイルの対応(adapter-static のデフォルト出力)
const pages = {
	'/': 'index.html',
	'/showcase': 'showcase.html',
	'/profile': 'profile.html'
};

const errors = [];

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

	// --- 3. 外部リソース参照の検出 ---------------------------------------

	// プロトコル相対 URL(//host/…)も外部参照として検出する
	const resourcePatterns = [
		{ label: '<link>', regex: /<link\s[^>]*href="((?:https?:)?\/\/[^"]*)"/g },
		{ label: '<script src>', regex: /<script\s[^>]*src="((?:https?:)?\/\/[^"]*)"/g },
		{ label: '<img src>', regex: /<img\s[^>]*src="((?:https?:)?\/\/[^"]*)"/g },
		// srcset は「値の先頭」または「カンマ・空白の直後」から始まる URL 候補のみ拾う
		{
			label: '<img srcset>',
			regex: /<img\s[^>]*srcset="(?:[^"]*[,\s])?((?:https?:)?\/\/[^\s,"]+)/g
		}
	];
	for (const [route, source] of Object.entries(html)) {
		for (const { label, regex } of resourcePatterns) {
			for (const match of source.matchAll(regex)) {
				errors.push(`外部リソース参照: ${route} の ${label} → ${match[1]}`);
			}
		}
	}
}

if (errors.length > 0) {
	console.error('check-static: NG');
	for (const error of errors) console.error(`  - ${error}`);
	process.exit(1);
}

console.log('check-static: OK(3 ページの存在・相互到達性・外部リソースなしを確認)');
