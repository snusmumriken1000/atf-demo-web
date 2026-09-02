import { describe, expect, it } from 'vitest';
import { createBot } from './answer';
import { detectIntent } from './intents';
import { createIndex, search } from './retrieve';
import { buildKnowledge } from './knowledge';
import { testContent } from './testContent';

const bot = () => createBot(testContent());

describe('detectIntent', () => {
	it.each([
		['こんにちは', 'greeting'],
		['何が聞けますか?', 'help'],
		['経歴を教えてください', 'career'],
		['職歴は?', 'career'],
		['使える技術は?', 'skill'],
		['どんな作品がありますか?', 'work'],
		['GitHub はありますか', 'link'],
		['このサイトについて教えて', 'site'],
		['どんな人ですか', 'about']
	])('「%s」を %s と判定する', (question, expected) => {
		expect(detectIntent(question)).toBe(expected);
	});

	it('手がかりがない質問は unknown にする(検索に委ねる)', () => {
		expect(detectIntent('今日の天気は?')).toBe('unknown');
	});

	it('英語の手がかり語でも判定する', () => {
		expect(detectIntent('What is your career?')).toBe('career');
	});

	it('英語の手がかり語が語の一部に反応しない', () => {
		// "guardrail" の中の ai、"this" の中の hi に反応してはいけない
		expect(detectIntent('Static Guardrail って何?')).not.toBe('site');
		expect(detectIntent('what is this')).not.toBe('greeting');
	});

	it('語尾が変わっても意図を拾う', () => {
		expect(detectIntent('TypeScript は使えますか?')).toBe('skill');
		expect(detectIntent('使えるものは?')).toBe('skill');
	});
});

describe('search', () => {
	const index = createIndex(buildKnowledge(testContent()));

	it('技術名で該当する知識を見つける', () => {
		const [top] = search(index, 'TypeScript');
		expect(top.entry.title).toBe('フロントエンド');
	});

	it('作品名で該当する作品を見つける', () => {
		const [top] = search(index, 'Sound Garden について');
		expect(top.entry.id).toBe('work-sound-garden');
	});

	it('関連のない質問では何も返さない(答えられないの判断材料になる)', () => {
		expect(search(index, 'ラーメンのおすすめ')).toEqual([]);
	});

	it('スコア順に並ぶ', () => {
		const hits = search(index, 'Svelte Web Audio 音');
		const scores = hits.map((hit) => hit.score);
		expect(scores).toEqual([...scores].sort((a, b) => b - a));
	});
});

describe('createBot', () => {
	it('経歴を聞かれたら経歴を全件、新しい順のまま返す', () => {
		const answer = bot().ask('経歴を教えてください');

		expect(answer.intent).toBe('career');
		expect(answer.lead).toBe('これまでの経歴です。');
		expect(answer.entries.map((entry) => entry.title)).toEqual([
			'フロントエンドエンジニア / テスト株式会社',
			'Web エンジニア / サンプル工房'
		]);
		expect(answer.unresolved).toBe(false);
	});

	it('スキルを聞かれたら分類をまとめて返す', () => {
		const answer = bot().ask('使える技術は?');
		expect(answer.entries.map((entry) => entry.title)).toEqual(['フロントエンド', 'ツール']);
	});

	it('作品を聞かれたら作品を返し、面 2 へのリンクを添える', () => {
		const answer = bot().ask('どんな作品がありますか?');

		expect(answer.entries.map((entry) => entry.id)).toContain('work-sound-garden');
		expect(answer.entries[0].links.some((link) => link.type === 'internal')).toBe(true);
	});

	it('特定の作品を聞かれたら、その作品を先頭に置く', () => {
		const answer = bot().ask('Sound Garden はどんな作品?');
		expect(answer.entries[0].id).toBe('work-sound-garden');
	});

	it('技術名だけで聞かれても、意図が分からないまま検索で答える', () => {
		const answer = bot().ask('Vitest');

		expect(answer.intent).toBe('unknown');
		expect(answer.lead).toBe('近いのはこのあたりです。');
		expect(answer.entries[0].title).toBe('ツール');
	});

	it('挨拶には知識を出さず、聞けることを案内する', () => {
		const answer = bot().ask('こんにちは');

		expect(answer.entries).toEqual([]);
		expect(answer.unresolved).toBe(false);
		expect(answer.suggestions).toEqual(testContent().ask.suggestions);
	});

	it('答えられない質問には、答えられる範囲を提示する', () => {
		const answer = bot().ask('明日の天気を教えて');

		expect(answer.unresolved).toBe(true);
		expect(answer.lead).toBe('お答えできません。');
		expect(answer.suggestions.length).toBeGreaterThan(0);
	});

	it('空の質問では何も答えない', () => {
		expect(bot().ask('   ').unresolved).toBe(true);
	});

	it('1 回の回答に載せる知識は 4 件までにする', () => {
		expect(bot().ask('作品').entries.length).toBeLessThanOrEqual(4);
	});

	it('content.ts を書き換えると回答も変わる(知識源が content.ts であること)', () => {
		const content = testContent();
		content.works = [
			{ id: 'new-thing', title: '新しい作品', blurb: '差し替えた作品です', hue: 10 }
		];
		const answer = createBot(content).ask('どんな作品がありますか?');

		expect(answer.entries.map((entry) => entry.title)).toEqual(['新しい作品']);
	});

	it('前置きの文も content.ts から引く', () => {
		const content = testContent();
		content.ask.leads.work = 'つくったものはこちら。';
		expect(createBot(content).ask('作品は?').lead).toBe('つくったものはこちら。');
	});

	it('その種類の知識が content.ts に無ければ、検索結果か「答えられない」に落ちる', () => {
		const content = testContent();
		delete content.profile.links;
		const answer = createBot(content).ask('連絡先はありますか');

		expect(answer.entries.every((entry) => entry.kind !== 'link')).toBe(true);
	});
});
