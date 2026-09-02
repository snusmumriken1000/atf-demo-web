import { describe, expect, it } from 'vitest';
import type { SiteContent } from './content.types';
import { validateContent } from './content.validation';

const minimalContent = (): SiteContent => ({
	site: {
		title: 'Test',
		entryLead: 'Lead',
		faces: {
			showcase: { label: 'Showcase', lead: 'Lead' },
			profile: { label: 'Profile', lead: 'Lead' }
		},
		navigation: {
			top: 'Top',
			switcherLabel: 'Switch',
			entryLabel: 'Entry',
			skipToContent: 'Skip',
			scrollHint: 'Scroll'
		}
	},
	hero: { name: 'Name', statement: 'Statement', worksLabel: 'Works' },
	profile: {
		sectionLabels: {
			about: 'About',
			career: 'Career',
			skills: 'Skills',
			works: 'Works',
			links: 'Links'
		},
		workMetaLabels: { role: 'Role', period: 'Year', tech: 'Stack' },
		career: [],
		skills: []
	},
	works: [{ id: 'valid-id', title: 'Work', blurb: 'Blurb', hue: 0 }],
	audio: {
		label: 'Sound',
		enableLabel: 'Enable',
		disableLabel: 'Disable',
		hint: 'Headphones',
		volume: 0.5,
		baseHz: 130.81,
		octaveRange: 2
	}
});

describe('validateContent', () => {
	it('任意フィールドを省略した最小コンテンツを許容する', () => {
		expect(() => validateContent(minimalContent())).not.toThrow();
	});

	it.each(['Invalid_ID', 'space id', '日本語'])('不正な作品 id「%s」を拒否する', (id) => {
		const candidate = minimalContent();
		candidate.works[0].id = id;
		expect(() => validateContent(candidate)).toThrow(/works\.id/);
	});

	it('重複する作品 id を拒否する', () => {
		const candidate = minimalContent();
		candidate.works.push({ ...candidate.works[0], title: 'Another' });
		expect(() => validateContent(candidate)).toThrow(/works\.id に重複/);
	});

	it('keyed each に使うスキル分類 label の重複を拒否する', () => {
		const candidate = minimalContent();
		candidate.profile.skills = [
			{ label: 'Frontend', items: [] },
			{ label: 'Frontend', items: [] }
		];
		expect(() => validateContent(candidate)).toThrow(/profile\.skills\.label に重複/);
	});

	it('リンクの label と url の重複を拒否する', () => {
		const candidate = minimalContent();
		candidate.profile.links = [
			{ label: 'GitHub', url: 'https://example.com/one' },
			{ label: 'GitHub', url: 'https://example.com/two' }
		];
		expect(() => validateContent(candidate)).toThrow(/profile\.links\.label に重複/);
	});

	it.each([
		['audio.volume', (candidate: SiteContent) => (candidate.audio.volume = 1.4)],
		['audio.baseHz', (candidate: SiteContent) => (candidate.audio.baseHz = 5)],
		['audio.octaveRange', (candidate: SiteContent) => (candidate.audio.octaveRange = 9)]
	])('範囲外の %s を拒否する', (path, mutate) => {
		const candidate = minimalContent();
		mutate(candidate);
		expect(() => validateContent(candidate)).toThrow(new RegExp(path.replace('.', '\\.')));
	});

	it('範囲内の音の設定は許容する', () => {
		const candidate = minimalContent();
		candidate.audio.volume = 0;
		candidate.audio.octaveRange = 0.5;
		expect(() => validateContent(candidate)).not.toThrow();
	});
});
