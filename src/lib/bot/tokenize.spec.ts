import { describe, expect, it } from 'vitest';
import { tokenize } from './tokenize';

describe('tokenize', () => {
	it('英数字はそのまま 1 語にする', () => {
		expect(tokenize('TypeScript Svelte 2026')).toEqual(['typescript', 'svelte', '2026']);
	});

	it('日本語は文字バイグラムに割る', () => {
		expect(tokenize('スキル')).toEqual(['スキ', 'キル']);
	});

	it('日本語と英語が混ざっていても両方拾う', () => {
		expect(tokenize('TypeScript の経験')).toEqual(['typescript', 'の経', '経験']);
	});

	it('全角と半角の違いを吸収する(NFKC 正規化)', () => {
		expect(tokenize('ＴｙｐｅＳｃｒｉｐｔ')).toEqual(tokenize('TypeScript'));
	});

	it('大文字小文字を区別しない', () => {
		expect(tokenize('SVELTE')).toEqual(tokenize('svelte'));
	});

	it('記号や空白だけの入力では何も返さない', () => {
		expect(tokenize('   !!! ??? ')).toEqual([]);
		expect(tokenize('')).toEqual([]);
	});

	it('単独の助詞は落とす(どこにでも出て検索の役に立たない)', () => {
		expect(tokenize('作品 は ?')).toEqual(['作品']);
	});

	it('句読点をまたいで語が繋がらない', () => {
		expect(tokenize('経歴、スキル')).toEqual(['経歴', 'スキ', 'キル']);
	});

	it('質問文からでも中心の語を取り出せる', () => {
		expect(tokenize('どんな作品がありますか?')).toContain('作品');
	});

	it('C++ や Node.js のような記号付きの技術名を 1 語として保つ', () => {
		// 単独の「と」は助詞として落とされる
		expect(tokenize('Node.js と C++')).toEqual(['node.js', 'c++']);
	});

	it('文中の語は、質問の言い回しが違っても同じバイグラムで一致する', () => {
		const question = tokenize('使える技術は?');
		const document = tokenize('スキル: TypeScript / 技術スタック');
		expect(question.filter((token) => document.includes(token))).toContain('技術');
	});
});
