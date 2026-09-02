import { describe, expect, it } from 'vitest';
import { buildKnowledge } from './knowledge';
import { testContent } from './testContent';

const knowledge = () => buildKnowledge(testContent());
const byKind = (kind: string) => knowledge().filter((entry) => entry.kind === kind);

describe('buildKnowledge', () => {
	it('経歴・スキル・作品・リンクをそれぞれ検索単位に分ける', () => {
		expect(byKind('career')).toHaveLength(2);
		expect(byKind('skill')).toHaveLength(2);
		expect(byKind('work')).toHaveLength(2);
		expect(byKind('link')).toHaveLength(1);
		expect(byKind('about')).toHaveLength(1);
		expect(byKind('site')).toHaveLength(1);
	});

	it('経歴には所属と期間が入る', () => {
		const [latest] = byKind('career');
		expect(latest.title).toBe('フロントエンドエンジニア / テスト株式会社');
		expect(latest.meta).toContain('2022 — 現在');
		expect(latest.body).toEqual(['デザインシステムの整備を主導しました。']);
	});

	it('省略された項目があっても壊れない(summary なしの経歴)', () => {
		const [, older] = byKind('career');
		expect(older.body).toEqual([]);
		expect(older.title).toBe('Web エンジニア / サンプル工房');
	});

	it('スキルは分類ごとにまとめる', () => {
		const [frontend] = byKind('skill');
		expect(frontend.title).toBe('フロントエンド');
		expect(frontend.body).toEqual(['TypeScript(業務で 4 年)', 'Svelte']);
	});

	it('スキル項目名を表示用の補足に重複させない(検索キーワードとしてだけ持つ)', () => {
		const [frontend] = byKind('skill');
		expect(frontend.meta).toEqual([]);
		expect(frontend.keywords).toEqual(['TypeScript', 'Svelte']);
		// 表示には出ないが検索では当たる
		expect(frontend.text).toContain('TypeScript');
	});

	it('作品には役割・時期・使用技術を補足として持たせる', () => {
		const [work] = byKind('work');
		expect(work.body).toEqual([
			'音で遊ぶ実験的なサイト',
			'Web Audio API だけで音を合成する試みです。'
		]);
		expect(work.meta).toEqual(['Role: 設計・実装', 'Year: 2026', 'Stack: Svelte / Web Audio']);
	});

	it('作品から面 2 の該当箇所へリンクする', () => {
		const [work] = byKind('work');
		expect(work.links[0]).toEqual({
			type: 'internal',
			route: '/profile',
			hash: 'work-sound-garden',
			label: '作品'
		});
	});

	it('作品の外部リンクも保つ', () => {
		const [work] = byKind('work');
		expect(work.links).toContainEqual({
			type: 'external',
			url: 'https://github.com/example/sound-garden',
			label: 'GitHub'
		});
	});

	it('検索対象の文字列に題・本文・補足がすべて含まれる', () => {
		const [work] = byKind('work');
		expect(work.text).toContain('Sound Garden');
		expect(work.text).toContain('音で遊ぶ');
		expect(work.text).toContain('Web Audio');
	});

	it('自己紹介がない content でも成立する', () => {
		const content = testContent();
		delete content.profile.intro;
		const entries = buildKnowledge(content);

		expect(entries.some((entry) => entry.kind === 'about')).toBe(false);
		expect(entries.some((entry) => entry.kind === 'work')).toBe(true);
	});

	it('id が重複しない(回答の keyed each に使う)', () => {
		const ids = knowledge().map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
