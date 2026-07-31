import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/*
 * モーショントークン規約の静的テスト。
 *
 * 全アニメーション時間(duration / delay)は必ず motion トークン
 * (--motion-duration / --motion-duration-fade / --motion-stagger)経由で指定する規約。
 * これにより prefers-reduced-motion 時に global.css のトークン 0ms 化だけで
 * すべての演出が一括無効化される。ここでは transition / animation 宣言に
 * 生の ms / s 値がハードコードされていないことを検証する。
 */

const projectRoot = join(import.meta.dirname, '..', '..');

// transition / animation 系プロパティの宣言値に「数値 + ms / s」が現れたら違反
const hardcodedTime = /(?:transition|animation)[^:;{}]*:[^;{}]*\b\d+(?:\.\d+)?m?s\b/g;

/** src 以下の .svelte と src/lib/styles の .css(tokens.css 除く)を集める */
function collectTargets(): string[] {
	const targets: string[] = [];
	for (const entry of readdirSync(join(projectRoot, 'src'), { recursive: true })) {
		const path = join(projectRoot, 'src', String(entry));
		if (path.endsWith('.svelte')) targets.push(path);
		// トークン定義そのもの(tokens.css)だけは生の ms 値を持ってよい
		if (
			path.includes(join('lib', 'styles')) &&
			path.endsWith('.css') &&
			!path.endsWith('tokens.css')
		)
			targets.push(path);
	}
	return targets;
}

describe('モーショントークン規約', () => {
	it('transition / animation にハードコードの時間値がない', () => {
		const violations: string[] = [];
		for (const file of collectTargets()) {
			const content = readFileSync(file, 'utf-8');
			for (const match of content.matchAll(hardcodedTime)) {
				violations.push(`${relative(projectRoot, file)}: ${match[0].replace(/\s+/g, ' ')}`);
			}
		}

		expect(violations, 'アニメーション時間は motion トークン経由で指定すること').toEqual([]);
	});

	it('検査対象のファイルを収集できている(自壊防止)', () => {
		const targets = collectTargets();
		// .svelte 数枚 + global.css / fonts.css は必ず存在するはず
		expect(targets.length).toBeGreaterThanOrEqual(5);
	});
});
