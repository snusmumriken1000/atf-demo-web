/*
 * scripts/check-static.mjs の統合テスト。
 *
 * スクリプトは「cwd の build/ を検証して exit code で結果を返す」CLI なので、
 * 一時ディレクトリにフィクスチャの build/ を作り、子プロセスとして実行して
 * exit code と stdout / stderr を検証する(node 環境のみ・ブラウザ不要)。
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-static.mjs', import.meta.url));
const tempDirs: string[] = [];

afterAll(() => {
	for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

// adapter-static の出力を模した最小 HTML(本文にアンカーのみ)
const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;
const links = (...hrefs: string[]) => hrefs.map((href) => `<a href="${href}">link</a>`).join(' ');

// 実際のプリレンダリング出力と同じ相対リンク構成(全ページ相互リンク)
const validBuild = {
	'index.html': page(links('#main', './showcase/', './profile/')),
	'showcase/index.html': page(links('#main', '../', '../profile/')),
	'profile/index.html': page(links('#main', '../', '../showcase/'))
};

function runCheck(files: Record<string, string>, basePath = '') {
	const dir = mkdtempSync(join(tmpdir(), 'check-static-'));
	tempDirs.push(dir);
	mkdirSync(join(dir, 'build'));
	for (const [name, content] of Object.entries(files)) {
		// _app/immutable/assets/app.css のようなネストしたパスにも対応する
		const path = join(dir, 'build', name);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}
	return spawnSync(process.execPath, [script], {
		cwd: dir,
		encoding: 'utf8',
		env: { ...process.env, BASE_PATH: basePath }
	});
}

describe('check-static.mjs', () => {
	it('3 ページが相互リンクしていれば成功する', () => {
		const result = runCheck(validBuild);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('check-static: OK');
	});

	it('project base 配信で root 絶対の内部 asset を拒否する', () => {
		const result = runCheck(
			{
				...validBuild,
				'index.html': page(
					`${links('./showcase/', './profile/')}<link rel="preload" as="font" href="/_app/font.woff2">`
				)
			},
			'/atf-demo-web'
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('base 外の絶対リソース参照');
		expect(result.stderr).toContain('/_app/font.woff2');
	});

	it('project base 内の絶対 asset は許可する', () => {
		const result = runCheck(
			{
				...validBuild,
				'index.html': page(
					`${links('./showcase/', './profile/')}<link rel="preload" as="font" href="/atf-demo-web/_app/font.woff2">`
				)
			},
			'/atf-demo-web'
		);
		expect(result.status).toBe(0);
	});

	it('ページが欠けていると失敗する', () => {
		const withoutProfile = Object.fromEntries(
			Object.entries(validBuild).filter(([name]) => name !== 'profile/index.html')
		);
		const result = runCheck(withoutProfile);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('profile/index.html');
	});

	it('リンクが欠けて到達不能なページがあると失敗する', () => {
		const result = runCheck({
			...validBuild,
			// showcase から他ページへのリンクをなくす → showcase 起点で到達不能
			'showcase/index.html': page(links('#main'))
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('到達できません');
	});

	it('直接リンクがなくても推移的に到達できれば成功する', () => {
		const result = runCheck({
			'index.html': page(links('./showcase/')),
			'showcase/index.html': page(links('../profile/')),
			'profile/index.html': page(links('../'))
		});
		expect(result.status).toBe(0);
	});

	it('外部リソース参照(script src)があると失敗する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(
				`${links('./showcase', './profile')}<script src="https://cdn.example.com/a.js"></script>`
			)
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('外部 URL 参照');
	});

	it('プロトコル相対 URL の外部リソース参照も検出する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(
				`${links('./showcase', './profile')}<script src="//cdn.example.com/a.js"></script>`
			)
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('外部 URL 参照');
	});

	it('外部サイトへのハイパーリンク(a href)は許容する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(links('./showcase', './profile', 'https://github.com/example'))
		});
		expect(result.status).toBe(0);
	});

	// --- CSS -------------------------------------------------------------

	it('CSS の @font-face で外部 URL を参照すると失敗する', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/assets/app.css':
				'@font-face { font-family: X; src: url(https://fonts.example.com/x.woff2); }'
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('https://fonts.example.com/x.woff2');
	});

	it('CSS の相対パス url()(woff2 等)は許容する', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/assets/app.css':
				'@font-face { font-family: X; src: url("./fonts/x.woff2") format("woff2"); }'
		});
		expect(result.status).toBe(0);
	});

	it('CSS の @import 文字列形式で外部 URL を参照すると失敗する', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/assets/app.css': '@import "https://fonts.example.com/css?family=X";'
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('外部 URL 参照');
	});

	it('CSS の data: URI は許容する', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/assets/app.css':
				'.icon { background: url(data:image/svg+xml;base64,PHN2Zy8+); }'
		});
		expect(result.status).toBe(0);
	});

	it('インライン <style> の外部 url() は失敗する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(
				`${links('./showcase', './profile')}<style>body { background: url("https://cdn.example.com/bg.png"); }</style>`
			)
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('<style> ブロック');
	});

	// --- JS ----------------------------------------------------------------

	it('JS の svelte.dev エラーメッセージ URL は許容リストで通る', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/chunks/runtime.js':
				'const e = new Error(`https://svelte.dev/e/effect_orphan`);'
		});
		expect(result.status).toBe(0);
	});

	it('JS の XML 名前空間 URI(完全一致)は許容する', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/chunks/ns.js':
				"const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');"
		});
		expect(result.status).toBe(0);
	});

	it('JS の名前空間 URI に一致しない w3.org URL は検出する', () => {
		const result = runCheck({
			...validBuild,
			// 完全一致リスト運用の確認: プレフィックスは同じでも実在リソースの
			// パスは許容しない
			'_app/immutable/chunks/w3.js': 'fetch("http://www.w3.org/Icons/valid-html401.png");'
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('http://www.w3.org/Icons/valid-html401.png');
	});

	it('JS の許容外 URL リテラルは失敗する', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/chunks/api.js': 'fetch("https://api.example.com/data");'
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('https://api.example.com/data');
	});

	it('HTML の外部ハイパーリンクと同じ URL がクライアント JS に含まれても許容する', () => {
		const url = 'https://github.com/example/project';
		const result = runCheck({
			...validBuild,
			'profile.html': page(links('#main', './', './showcase', url)),
			'_app/immutable/chunks/profile.js': `const link = "${url}";`
		});
		expect(result.status).toBe(0);
	});

	it('JS の文字列途中に現れる絶対 URL も検出する', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/chunks/req.js': 'const u = "GET https://api.example.com/x";'
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('https://api.example.com/x');
	});

	it('JS のプロトコル相対 URL リテラルも検出する', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/chunks/cdn.js': "const src = '//cdn.example.com/lib.js';"
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('//cdn.example.com/lib.js');
	});

	// --- HTML 属性の網羅 / 名前空間 -----------------------------------------

	it('iframe や video poster の外部 URL も検出する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(
				`${links('./showcase', './profile')}<iframe src="https://embed.example.com/x"></iframe>`
			),
			'showcase.html': page(
				`${links('#main', './', './profile')}<video poster="https://cdn.example.com/p.jpg"></video>`
			)
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('<iframe src>');
		expect(result.stderr).toContain('<video poster>');
	});

	it('引用符なし(unquoted)属性値の外部 URL も検出する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(
				`${links('./showcase', './profile')}<img src=https://cdn.example.com/a.png>`
			),
			'showcase.html': page(
				`${links('#main', './', './profile')}<script src=//cdn.example.com/b.js></script>`
			)
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('https://cdn.example.com/a.png');
		expect(result.stderr).toContain('//cdn.example.com/b.js');
	});

	it('引用符なしの <a href> 外部ハイパーリンクも許容する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(
				`${links('./showcase', './profile')}<a href=https://github.com/example>link</a>`
			)
		});
		expect(result.status).toBe(0);
	});

	it('JS 向け許容リストの URL でも HTML 属性(img src 等)では検出する', () => {
		const result = runCheck({
			...validBuild,
			// 許容はコンテキストごとに分離されている: JS リテラル文脈で許容される
			// URL でも、リソースとして読み込まれる属性値では違反とする
			'index.html': page(
				`${links('./showcase', './profile')}<img src="https://svelte.dev/e/logo.png">`
			),
			'showcase.html': page(
				`${links('#main', './', './profile')}<img src="http://www.w3.org/Icons/valid-html401.png">`
			)
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('https://svelte.dev/e/logo.png');
		expect(result.stderr).toContain('http://www.w3.org/Icons/valid-html401.png');
	});

	it('インライン <script> 内の外部 URL(fetch 等)は検出する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(
				`${links('./showcase', './profile')}<script>fetch("https://analytics.example.com/beacon");</script>`
			)
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('インライン <script>');
		expect(result.stderr).toContain('https://analytics.example.com/beacon');
	});

	it('JS 文字列に <style> タグが含まれても後続の外部 URL を検出する', () => {
		const result = runCheck({
			...validBuild,
			// <style> 除去が <script> 抽出より先だと、"<style>"…"</style>" の間の
			// コードが script 本文から欠けて素通りする(その回帰テスト)
			'index.html': page(
				`${links('./showcase', './profile')}<script>const a = "<style>"; fetch("https://api.example.com/x"); const b = "</style>";</script>`
			)
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('https://api.example.com/x');
	});

	it('style 属性内の外部 url() は検出する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(
				`${links('./showcase', './profile')}<div style="background: url('https://cdn.example.com/bg.png')">x</div>`
			)
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('style 属性');
		expect(result.stderr).toContain('https://cdn.example.com/bg.png');
	});

	it('data: URI の favicon に含まれる名前空間 URI は許容する', () => {
		const result = runCheck({
			...validBuild,
			// 実ビルドの favicon と同じ形式(data: URI 内の xmlns='http://www.w3.org/2000/svg')
			'index.html': page(links('#main', './showcase', './profile')).replace(
				'<head>',
				`<head><link rel="icon" href="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%3e%3c/svg%3e" />`
			)
		});
		expect(result.status).toBe(0);
	});

	it('xmlns / xmlns:* の名前空間宣言は許容する', () => {
		const result = runCheck({
			...validBuild,
			// 属性名(xmlns / xmlns:*)による許容を確認する目的で、
			// 許容リスト外の名前空間 URI も含める
			'icon.svg':
				'<svg xmlns="http://www.w3.org/2000/svg" xmlns:custom="https://ns.example.com/custom"><rect/></svg>'
		});
		expect(result.status).toBe(0);
	});

	it('SVG 内の外部 image href は検出する', () => {
		const result = runCheck({
			...validBuild,
			'icon.svg':
				'<svg xmlns="http://www.w3.org/2000/svg"><image href="https://cdn.example.com/a.png"/></svg>'
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('<image href>');
	});
});
