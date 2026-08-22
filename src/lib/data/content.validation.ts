import type { SiteContent, WorkLink } from './content.types';

const assertUnique = (values: string[], path: string) => {
	const seen = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) {
			throw new Error(`content.ts: ${path} に重複があります: "${value}"`);
		}
		seen.add(value);
	}
};

const validateLinks = (links: WorkLink[] | undefined, path: string) => {
	if (!links) return;
	assertUnique(
		links.map((link) => link.url),
		`${path}.url`
	);
	assertUnique(
		links.map((link) => link.label),
		`${path}.label`
	);
};

const assertNonEmptyString = (value: string, path: string) => {
	if (value.trim().length === 0) throw new Error(`content.ts: ${path} は空文字にできません`);
};

const assertNonEmptyStrings = (values: string[], path: string) => {
	if (values.length === 0) throw new Error(`content.ts: ${path} は空配列にできません`);
	values.forEach((value, index) => assertNonEmptyString(value, `${path}[${index}]`));
};

/**
 * 型だけでは表せない content.ts 内の識別子・Svelte keyed each の一意性を検証する。
 * content.ts の読み込み時に実行し、編集ミスを build/test の早い段階で明示する。
 */
export const validateContent = (content: SiteContent) => {
	assertUnique(
		content.works.map((work) => work.id),
		'works.id'
	);
	for (const work of content.works) {
		if (!/^[a-z0-9-]+$/.test(work.id)) {
			throw new Error(
				`content.ts: works.id は半角英小文字・数字・ハイフンだけで書いてください: "${work.id}"`
			);
		}
		assertNonEmptyString(work.title, `works[${work.id}].title`);
		assertNonEmptyString(work.blurb, `works[${work.id}].blurb`);
		assertNonEmptyString(work.role, `works[${work.id}].role`);
		assertNonEmptyString(work.period, `works[${work.id}].period`);
		assertNonEmptyStrings(work.tech, `works[${work.id}].tech`);
		assertNonEmptyStrings(work.context, `works[${work.id}].context`);
		assertNonEmptyStrings(work.approach, `works[${work.id}].approach`);
		assertNonEmptyStrings(work.outcome, `works[${work.id}].outcome`);
		if (!Number.isFinite(work.hue) || work.hue < 0 || work.hue > 360) {
			throw new Error(`content.ts: works[${work.id}].hue は 0〜360 の数値にしてください`);
		}
		assertUnique(work.description ?? [], `works[${work.id}].description`);
		assertUnique(work.context, `works[${work.id}].context`);
		assertUnique(work.approach, `works[${work.id}].approach`);
		assertUnique(work.outcome, `works[${work.id}].outcome`);
		validateLinks(work.links, `works[${work.id}].links`);
	}

	assertUnique(content.profile.intro ?? [], 'profile.intro');
	assertUnique(
		content.profile.career.map((entry) => `${entry.period}-${entry.title}`),
		'profile.career(period + title)'
	);
	assertUnique(
		content.profile.expertise.map((item) => item.title),
		'profile.expertise.title'
	);
	assertUnique(
		content.profile.skills.map((group) => group.label),
		'profile.skills.label'
	);
	for (const group of content.profile.skills) {
		assertUnique(
			group.items.map((skill) => skill.name),
			`profile.skills[${group.label}].items.name`
		);
	}
	assertUnique(content.profile.workingStyle, 'profile.workingStyle');
	validateLinks(content.profile.links, 'profile.links');
};
