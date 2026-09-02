/*
 * 質問の「意図」を、含まれる言葉から判定する。
 *
 * 検索(retrieve.ts)だけだと「経歴は?」のような短い質問で
 * 特定の 1 件しか返せない。意図が分かればその種類の知識をまとめて出せるので、
 * 「経歴は?」→ 経歴を全部、「何ができる?」→ スキルを全部、と答えられる。
 *
 * ここに並ぶ語は表示されない(内部の判定条件)ため content.ts には置かない。
 * content.ts を英語に差し替えても、英語の手がかり語で判定は続く。
 */

import type { KnowledgeKind } from './knowledge';

/** 意図。知識の種類 + 挨拶 + 仕組みの質問 */
export type Intent = KnowledgeKind | 'greeting' | 'help' | 'unknown';

type IntentRule = {
	intent: Intent;
	/** この語が質問に含まれていたら、その意図とみなす */
	cues: string[];
};

/*
 * 上にあるものから順に判定する。挨拶や「何ができる?」のような
 * サイト全体に関わる問いを先に拾い、そのあと内容の種類を見る。
 */
const RULES: IntentRule[] = [
	{
		intent: 'greeting',
		cues: ['こんにちは', 'こんばんは', 'おはよう', 'はじめまして', 'やあ', 'hello', 'hi', 'hey']
	},
	{
		intent: 'help',
		cues: [
			// 「聞けますか」「聞けるの?」など語尾の違いを拾うため語幹で持つ
			'何が聞け',
			'なにが聞け',
			'何ができ',
			'なにができ',
			'使い方',
			'助けて',
			'ヘルプ',
			'help',
			'どう使う'
		]
	},
	{
		intent: 'site',
		cues: [
			'このサイト',
			'サイトについて',
			'仕組み',
			'どうやって動',
			'ai',
			'ボット',
			'bot',
			'面',
			'ページ'
		]
	},
	{
		intent: 'career',
		cues: [
			'経歴',
			'職歴',
			'キャリア',
			'経験',
			'どこで働',
			'勤め',
			'会社',
			'学歴',
			'career',
			'experience'
		]
	},
	{
		intent: 'skill',
		cues: [
			'スキル',
			'技術',
			'できること',
			'得意',
			'言語',
			'使え',
			'技術スタック',
			'skill',
			'stack',
			'tech'
		]
	},
	{
		intent: 'work',
		cues: [
			'作品',
			'プロダクト',
			'プロジェクト',
			'制作',
			'つくった',
			'作った',
			'実績',
			'work',
			'project',
			'portfolio'
		]
	},
	{
		intent: 'link',
		cues: ['連絡', 'コンタクト', 'リンク', 'github', 'sns', 'contact', 'link']
	},
	{
		intent: 'about',
		cues: ['自己紹介', 'どんな人', '誰', 'だれ', 'あなたは', 'プロフィール', 'about', 'who']
	}
];

/** 英数字だけでできた手がかり語(英語の cue)か */
const ASCII_CUE = /^[a-z0-9 .+#-]+$/;

/**
 * 手がかり語が質問に含まれるか。
 *
 * 英語の cue は語の区切りで照合する。単純な部分一致にすると
 * 「Static Guardrail」の中の "ai"、「this」の中の "hi" のように
 * 無関係な語の一部に反応してしまうため。
 * 日本語は語の区切りがないので、そのまま部分一致で見る。
 */
function matchesCue(normalized: string, cue: string): boolean {
	if (!ASCII_CUE.test(cue)) return normalized.includes(cue);
	const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalized);
}

/**
 * 質問から意図を判定する。手がかりが見つからなければ 'unknown' を返し、
 * 呼び出し側(answer.ts)は全文検索の結果だけで答える。
 */
export function detectIntent(question: string): Intent {
	const normalized = question.normalize('NFKC').toLowerCase();
	for (const rule of RULES) {
		if (rule.cues.some((cue) => matchesCue(normalized, cue))) return rule.intent;
	}
	return 'unknown';
}

/** その意図が「知識の種類をまとめて出す」ものなら、その種類を返す */
export function kindForIntent(intent: Intent): KnowledgeKind | null {
	switch (intent) {
		case 'about':
		case 'career':
		case 'skill':
		case 'work':
		case 'link':
		case 'site':
			return intent;
		default:
			return null;
	}
}
