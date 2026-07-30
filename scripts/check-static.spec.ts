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
import { join } from 'node:path';
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
		writeFileSync(join(dir, 'build', name), content);
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
		expect(result.stderr).toContain('外部リソース参照');
	});

	it('外部サイトへのハイパーリンク(a href)は許容する', () => {
		const result = runCheck({
			...validBuild,
			'index.html': page(links('./showcase', './profile', 'https://github.com/example'))
		});
		expect(result.status).toBe(0);
	});
});
