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
		},
		mockNotice: 'Mock'
	},
	hero: { name: 'Name', statement: 'Statement', worksLabel: 'Works' },
	profile: {
		sections: {
			profile: { label: 'Profile' },
			work: { label: 'Work' }
		},
		sectionLabels: {
			about: 'About',
			career: 'Career',
			expertise: 'Expertise',
			skills: 'Skills',
			workingStyle: 'Working Style',
			links: 'Links'
		},
		workMetaLabels: {
			role: 'Role',
			period: 'Year',
			tech: 'Stack',
			context: 'Context',
			approach: 'Approach',
			outcome: 'Outcome'
		},
		career: [],
		expertise: [],
		skills: [],
		workingStyle: []
	},
	works: [{ id: 'valid-id', title: 'Work', blurb: 'Blurb', hue: 0 }]
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

	it.each(['context', 'approach', 'outcome'] as const)(
		'作品の %s 段落の重複を拒否する',
		(field) => {
			const candidate = minimalContent();
			candidate.works[0][field] = ['同じ段落', '同じ段落'];
			expect(() => validateContent(candidate)).toThrow(
				new RegExp(`works\\[valid-id\\]\\.${field} に重複`)
			);
		}
	);

	it('keyed each に使う得意領域 title の重複を拒否する', () => {
		const candidate = minimalContent();
		candidate.profile.expertise = [
			{ title: 'Design Systems', description: 'One' },
			{ title: 'Design Systems', description: 'Two' }
		];
		expect(() => validateContent(candidate)).toThrow(/profile\.expertise\.title に重複/);
	});

	it('仕事のスタイルの重複を拒否する', () => {
		const candidate = minimalContent();
		candidate.profile.workingStyle = ['同じスタイル', '同じスタイル'];
		expect(() => validateContent(candidate)).toThrow(/profile\.workingStyle に重複/);
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
});
