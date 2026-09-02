/*
 * 質問に対する回答を組み立てる。
 *
 * 手順は 2 段構え:
 *   1. 意図(intents.ts)が分かれば、その種類の知識をまとめて出す
 *      例: 「経歴は?」→ 経歴を全件、「何ができる?」→ スキルを全分類
 *   2. 意図が分からなければ、全文検索(retrieve.ts)の上位を出す
 * どちらも当たらなければ「答えられない」と返し、答えられる範囲を提示する。
 *
 * 回答の文面(前置き・答えられないときの言葉)は content.ts の ask.leads にあり、
 * 中身は知識(= content.ts)そのもの。つまりボットは何も創作せず、
 * サイトに書いてあることだけを返す。
 */

import type { SiteContent } from '$lib/data/content.types';
import { detectIntent, kindForIntent, type Intent } from './intents';
import { buildKnowledge, type KnowledgeEntry, type KnowledgeKind } from './knowledge';
import { createIndex, search, type SearchIndex } from './retrieve';

/** 1 回の回答 */
export type Answer = {
	/** 判定した意図(テスト・デバッグ用) */
	intent: Intent;
	/** 前置きの一文 */
	lead: string;
	/** 根拠として見せる知識。空なら前置きだけの回答 */
	entries: KnowledgeEntry[];
	/** 答えられなかったか */
	unresolved: boolean;
	/** 続けて聞ける質問の例 */
	suggestions: string[];
};

export type Bot = {
	/** ボットの知識(テスト・デバッグ用) */
	readonly knowledge: KnowledgeEntry[];
	ask(question: string): Answer;
};

/** 1 回の回答に載せる知識の最大数。多すぎると読む気を失う */
const MAX_ENTRIES = 4;

/** 意図に対応する前置きの文(content.ts の ask.leads から引く) */
function leadFor(content: SiteContent, intent: Intent): string {
	const { leads } = content.ask;
	switch (intent) {
		case 'greeting':
			return leads.greeting;
		case 'help':
			return leads.help;
		case 'about':
			return leads.about;
		case 'career':
			return leads.career;
		case 'skill':
			return leads.skill;
		case 'work':
			return leads.work;
		case 'link':
			return leads.link;
		case 'site':
			return leads.site;
		default:
			return leads.general;
	}
}

/** 検索で当たった順を優先しつつ、同じ種類の知識をまとめる */
function orderByRelevance(
	all: KnowledgeEntry[],
	kind: KnowledgeKind,
	ranked: KnowledgeEntry[]
): KnowledgeEntry[] {
	const ofKind = all.filter((entry) => entry.kind === kind);
	const hitIds = new Set(ranked.filter((entry) => entry.kind === kind).map((entry) => entry.id));
	// 検索で当たったものを先頭へ。残りは content.ts の記述順のまま続ける
	return [
		...ofKind.filter((entry) => hitIds.has(entry.id)),
		...ofKind.filter((entry) => !hitIds.has(entry.id))
	];
}

/**
 * content.ts からボットを作る。索引はここで 1 度だけ組む。
 * 以降 ask() は同期処理で完結する(通信は一切しない)。
 */
export function createBot(content: SiteContent): Bot {
	const knowledge = buildKnowledge(content);
	const index: SearchIndex = createIndex(knowledge);
	const { ask: askContent } = content;

	const unresolvedAnswer = (intent: Intent): Answer => ({
		intent,
		lead: askContent.fallback,
		entries: [],
		unresolved: true,
		suggestions: askContent.suggestions
	});

	return {
		knowledge,
		ask(question: string): Answer {
			const trimmed = question.trim();
			if (trimmed.length === 0) return unresolvedAnswer('unknown');

			const intent = detectIntent(trimmed);

			// 挨拶と「何が聞ける?」は知識を出さず、聞けることを案内する
			if (intent === 'greeting' || intent === 'help') {
				return {
					intent,
					lead: leadFor(content, intent),
					entries: [],
					unresolved: false,
					suggestions: askContent.suggestions
				};
			}

			const hits = search(index, trimmed, MAX_ENTRIES).map((hit) => hit.entry);
			const kind = kindForIntent(intent);

			if (kind) {
				const entries = orderByRelevance(knowledge, kind, hits).slice(0, MAX_ENTRIES);
				// その種類の知識が content.ts に無いときは検索結果に委ねる
				if (entries.length > 0) {
					return {
						intent,
						lead: leadFor(content, intent),
						entries,
						unresolved: false,
						suggestions: []
					};
				}
			}

			if (hits.length > 0) {
				return {
					intent,
					lead: leadFor(content, 'unknown'),
					entries: hits,
					unresolved: false,
					suggestions: []
				};
			}

			return unresolvedAnswer(intent);
		}
	};
}
