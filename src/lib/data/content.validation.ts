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

const assertRange = (value: number, min: number, max: number, path: string) => {
	if (!Number.isFinite(value) || value < min || value > max) {
		throw new Error(`content.ts: ${path} は ${min} 〜 ${max} の数値で書いてください: ${value}`);
	}
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
		assertUnique(work.description ?? [], `works[${work.id}].description`);
		validateLinks(work.links, `works[${work.id}].links`);
	}

	assertUnique(content.profile.intro ?? [], 'profile.intro');
	assertUnique(
		content.profile.career.map((entry) => `${entry.period}-${entry.title}`),
		'profile.career(period + title)'
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
	validateLinks(content.profile.links, 'profile.links');

	// 音の設定。範囲外の値は耳に痛い音や無音の原因になるため早い段階で弾く
	// 質問例は Svelte の keyed each に使うので重複を許さない
	assertUnique(content.ask.suggestions, 'ask.suggestions');
	if (content.ask.suggestions.length === 0) {
		throw new Error('content.ts: ask.suggestions は 1 件以上書いてください');
	}

	assertRange(content.audio.volume, 0, 1, 'audio.volume');
	assertRange(content.audio.bpm, 40, 180, 'audio.bpm');
	assertRange(content.audio.baseHz, 20, 2000, 'audio.baseHz');
	assertRange(content.audio.octaveRange, 0.5, 4, 'audio.octaveRange');
};
