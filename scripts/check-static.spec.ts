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
	'index.html': page(links('#main', './showcase', './profile')),
	'showcase.html': page(links('#main', './', './profile')),
	'profile.html': page(links('#main', './', './showcase'))
};

function runCheck(files: Record<string, string>) {
	const dir = mkdtempSync(join(tmpdir(), 'check-static-'));
	tempDirs.push(dir);
	mkdirSync(join(dir, 'build'));
	for (const [name, content] of Object.entries(files)) {
		// _app/immutable/assets/app.css のようなネストしたパスにも対応する
		const path = join(dir, 'build', name);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}
	return spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
}

describe('check-static.mjs', () => {
	it('3 ページが相互リンクしていれば成功する', () => {
		const result = runCheck(validBuild);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('check-static: OK');
	});

	it('ページが欠けていると失敗する', () => {
		const withoutProfile = Object.fromEntries(
			Object.entries(validBuild).filter(([name]) => name !== 'profile.html')
		);
		const result = runCheck(withoutProfile);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('profile.html');
	});

	it('リンクが欠けて到達不能なページがあると失敗する', () => {
		const result = runCheck({
			...validBuild,
			// showcase から他ページへのリンクをなくす → showcase 起点で到達不能
			'showcase.html': page(links('#main'))
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('到達できません');
	});

	it('直接リンクがなくても推移的に到達できれば成功する', () => {
		const result = runCheck({
			'index.html': page(links('./showcase')),
			'showcase.html': page(links('./profile')),
			'profile.html': page(links('./'))
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

	it('JS の許容外 URL リテラルは失敗する', () => {
		const result = runCheck({
			...validBuild,
			'_app/immutable/chunks/api.js': 'fetch("https://api.example.com/data");'
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('https://api.example.com/data');
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

	it('xmlns / xmlns:* の名前空間宣言は許容する', () => {
		const result = runCheck({
			...validBuild,
			// w3.org は許容プレフィックスでも通るため、属性名による許容を
			// 確認する目的で許容リスト外の名前空間 URI も含める
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
