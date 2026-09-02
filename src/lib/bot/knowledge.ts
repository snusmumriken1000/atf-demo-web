/*
 * ボットの知識を content.ts から組み立てる。
 *
 * ボットは外部 API も学習済みモデルも持たず、**このサイトに書いてあることだけ**を答える。
 * 知識源が content.ts なので、文言を差し替えればボットの回答も自動で変わる
 *(「表示する内容は単一のコンテンツファイルに集約する」という要件と噛み合う)。
 *
 * ここでは検索の単位(経歴 1 件・スキル 1 分類・作品 1 件…)に切り分けるだけで、
 * 関連度の計算は retrieve.ts、回答文の組み立ては answer.ts が担当する。
 */

import type { SiteContent } from '$lib/data/content.types';

/** 知識の種類。意図判定(intents.ts)と対応する */
export type KnowledgeKind = 'about' | 'career' | 'skill' | 'work' | 'link' | 'site';

/** 回答に添えるリンク。サイト内は route + hash、外部は URL で持つ */
export type KnowledgeLink =
	| { type: 'internal'; route: '/showcase' | '/profile'; hash?: string; label: string }
	| { type: 'external'; url: string; label: string };

/** 検索・回答の単位 */
export type KnowledgeEntry = {
	id: string;
	kind: KnowledgeKind;
	/** 回答の見出しに使う短い題 */
	title: string;
	/** 回答本文(段落) */
	body: string[];
	/** 「Stack: TypeScript」のような、回答に表示する補足 */
	meta: string[];
	/** 検索にだけ使う語(表示はしない)。表記ゆれの吸収に使う */
	keywords: string[];
	/** 検索対象の文字列(題 + 本文 + 補足 + キーワード) */
	text: string;
	links: KnowledgeLink[];
};

/** 空文字・空配列を落として本文を整える */
const compact = (values: (string | undefined)[]): string[] =>
	values.filter((value): value is string => Boolean(value && value.trim().length > 0));

const entry = (
	base: Omit<KnowledgeEntry, 'text' | 'meta' | 'keywords' | 'links'> &
		Partial<Pick<KnowledgeEntry, 'meta' | 'keywords' | 'links'>>
): KnowledgeEntry => {
	const meta = base.meta ?? [];
	const keywords = base.keywords ?? [];
	return {
		...base,
		meta,
		keywords,
		links: base.links ?? [],
		text: [base.title, ...base.body, ...meta, ...keywords].join(' ')
	};
};

/**
 * content.ts から知識を組み立てる。
 * 並び順は回答の優先順位ではなく content.ts の記述順(= サイトの表示順)に従う。
 */
export function buildKnowledge(content: SiteContent): KnowledgeEntry[] {
	const { site, hero, profile, works } = content;
	const entries: KnowledgeEntry[] = [];

	// --- 自己紹介 ---
	const intro = compact(profile.intro ?? []);
	if (intro.length > 0) {
		entries.push(
			entry({
				id: 'about',
				kind: 'about',
				title: profile.sectionLabels.about,
				body: intro,
				meta: compact([hero.name, hero.statement.replace('\n', ' ')]),
				links: [
					{
						type: 'internal',
						route: '/profile',
						hash: 'about-heading',
						label: site.faces.profile.label
					}
				]
			})
		);
	}

	// --- 経歴(1 件 = 1 エントリ) ---
	for (const [index, career] of profile.career.entries()) {
		entries.push(
			entry({
				id: `career-${index}`,
				kind: 'career',
				title: career.org ? `${career.title} / ${career.org}` : career.title,
				body: compact([career.summary]),
				meta: compact([career.period, career.org]),
				links: [
					{
						type: 'internal',
						route: '/profile',
						hash: 'career-heading',
						label: profile.sectionLabels.career
					}
				]
			})
		);
	}

	// --- スキル(1 分類 = 1 エントリ) ---
	for (const group of profile.skills) {
		entries.push(
			entry({
				id: `skill-${group.label}`,
				kind: 'skill',
				title: group.label,
				body: group.items.map((item) => (item.note ? `${item.name}(${item.note})` : item.name)),
				// 項目名は本文に出るので、補足ではなく検索用のキーワードとして持つ
				keywords: group.items.map((item) => item.name),
				links: [
					{
						type: 'internal',
						route: '/profile',
						hash: 'skills-heading',
						label: profile.sectionLabels.skills
					}
				]
			})
		);
	}

	// --- 作品(1 件 = 1 エントリ)---
	for (const work of works) {
		const links: KnowledgeLink[] = [
			{
				type: 'internal',
				route: '/profile',
				hash: `work-${work.id}`,
				label: profile.sectionLabels.works
			}
		];
		for (const link of work.links ?? []) {
			links.push({ type: 'external', url: link.url, label: link.label });
		}

		entries.push(
			entry({
				id: `work-${work.id}`,
				kind: 'work',
				title: work.title,
				body: compact([work.blurb, ...(work.description ?? [])]),
				meta: compact([
					work.role && `${profile.workMetaLabels.role}: ${work.role}`,
					work.period && `${profile.workMetaLabels.period}: ${work.period}`,
					work.tech?.length ? `${profile.workMetaLabels.tech}: ${work.tech.join(' / ')}` : undefined
				]),
				links
			})
		);
	}

	// --- 外部リンク ---
	for (const link of profile.links ?? []) {
		entries.push(
			entry({
				id: `link-${link.label}`,
				kind: 'link',
				title: link.label,
				body: [link.url],
				links: [{ type: 'external', url: link.url, label: link.label }]
			})
		);
	}

	// --- サイトそのものについて ---
	entries.push(
		entry({
			id: 'site',
			kind: 'site',
			title: site.title,
			body: compact([
				site.entryLead,
				`${site.faces.showcase.label}: ${site.faces.showcase.lead}`,
				`${site.faces.profile.label}: ${site.faces.profile.lead}`,
				`${site.faces.ask.label}: ${site.faces.ask.lead}`
			]),
			links: [
				{ type: 'internal', route: '/showcase', label: site.faces.showcase.label },
				{ type: 'internal', route: '/profile', label: site.faces.profile.label }
			]
		})
	);

	return entries;
}
