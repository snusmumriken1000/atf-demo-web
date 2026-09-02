/*
 * 知識の中から、質問に近いものを探す(BM25)。
 *
 * BM25 は語の頻度と希少さで関連度を測る、全文検索の標準的なスコアリング。
 * 「TypeScript」のような珍しい語が一致したときに強く効き、
 * 「こと」「もの」のようにどこにでもある語では効かない。
 *
 * 索引は content.ts から一度だけ組めばよく、以降の検索は同期処理で完結する
 *(通信もワーカーも使わない)。
 */

import type { KnowledgeEntry } from './knowledge';
import { tokenize } from './tokenize';

/** BM25 のパラメータ。全文検索で広く使われている既定値 */
const K1 = 1.2;
const B = 0.75;

/**
 * 検索結果として採用する下限スコア。
 * これを下回るものは「たまたま 1 文字かすった」程度なので答えに使わない。
 */
export const SCORE_THRESHOLD = 0.6;

type IndexedEntry = {
	entry: KnowledgeEntry;
	/** 語 → その語がこのエントリに何回出るか */
	frequencies: Map<string, number>;
	length: number;
};

export type SearchIndex = {
	entries: IndexedEntry[];
	/** 語 → その語を含むエントリ数 */
	documentFrequency: Map<string, number>;
	averageLength: number;
};

export type SearchHit = {
	entry: KnowledgeEntry;
	score: number;
};

/** 知識から検索索引を組む */
export function createIndex(entries: KnowledgeEntry[]): SearchIndex {
	const documentFrequency = new Map<string, number>();
	const indexed: IndexedEntry[] = entries.map((entry) => {
		const tokens = tokenize(entry.text);
		const frequencies = new Map<string, number>();
		for (const token of tokens) {
			frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
		}
		for (const token of frequencies.keys()) {
			documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
		}
		return { entry, frequencies, length: tokens.length };
	});

	const totalLength = indexed.reduce((sum, item) => sum + item.length, 0);
	return {
		entries: indexed,
		documentFrequency,
		averageLength: indexed.length > 0 ? totalLength / indexed.length : 0
	};
}

/** 語の希少さ(IDF)。よく出る語ほど 0 に近づく */
function inverseDocumentFrequency(index: SearchIndex, token: string): number {
	const total = index.entries.length;
	const containing = index.documentFrequency.get(token) ?? 0;
	if (containing === 0) return 0;
	return Math.log(1 + (total - containing + 0.5) / (containing + 0.5));
}

/**
 * 質問に近い知識を、関連度の高い順に返す。
 * しきい値(SCORE_THRESHOLD)に届かないものは落とすので、
 * 何も返らないことがある = 「答えられない」の判断材料になる。
 */
export function search(index: SearchIndex, question: string, limit = 3): SearchHit[] {
	const tokens = tokenize(question);
	if (tokens.length === 0 || index.entries.length === 0) return [];

	const hits: SearchHit[] = [];
	for (const item of index.entries) {
		let score = 0;
		for (const token of tokens) {
			const frequency = item.frequencies.get(token);
			if (!frequency) continue;
			const idf = inverseDocumentFrequency(index, token);
			const normalization =
				index.averageLength > 0 ? 1 - B + (B * item.length) / index.averageLength : 1;
			score += (idf * (frequency * (K1 + 1))) / (frequency + K1 * normalization);
		}
		if (score >= SCORE_THRESHOLD) hits.push({ entry: item.entry, score });
	}

	return hits
		.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
		.slice(0, limit);
}
