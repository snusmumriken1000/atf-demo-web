import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import { content } from '$lib/data/content';
import Page from './+page.svelte';

describe('profile ページ(/profile)', () => {
	it('2 大セクション(経歴・得意領域 / プロダクトと仕事)を h2 として表示する', () => {
		render(Page);

		const majorHeadings = screen.getAllByRole('heading', { level: 2 });
		expect(majorHeadings).toHaveLength(2);
		expect(majorHeadings[0]).toHaveTextContent(content.profile.sections.profile.label);
		expect(majorHeadings[1]).toHaveTextContent(content.profile.sections.work.label);
	});

	it('モックコンテンツである旨の注記をヘッダーに表示する', () => {
		render(Page);

		expect(screen.getByText(content.site.mockNotice)).toBeInTheDocument();
	});

	it('自己紹介・経歴・得意領域・スキル・仕事のスタイル・作品を content.ts の内容で表示する', () => {
		render(Page);

		expect(screen.getByRole('heading', { level: 1, name: content.hero.name })).toBeInTheDocument();
		expect(screen.getAllByRole('listitem')).toHaveLength(
			content.profile.career.length +
				content.profile.skills.reduce((sum, group) => sum + group.items.length, 0) +
				content.profile.workingStyle.length
		);

		for (const item of content.profile.expertise) {
			expect(screen.getByRole('heading', { level: 4, name: item.title })).toBeInTheDocument();
		}

		for (const work of content.works) {
			const detail = document.querySelector(`#work-${work.id}`);
			expect(detail).not.toBeNull();
			expect(
				within(detail as HTMLElement).getByRole('heading', { level: 3, name: work.title })
			).toBeInTheDocument();
		}
	});

	it('作品の Context / Approach / Outcome をフィールドがあるときだけ見出し付きで表示する', () => {
		render(Page);

		const { workMetaLabels } = content.profile;
		for (const work of content.works) {
			const detail = document.querySelector(`#work-${work.id}`) as HTMLElement;
			for (const [field, label] of [
				['context', workMetaLabels.context],
				['approach', workMetaLabels.approach],
				['outcome', workMetaLabels.outcome]
			] as const) {
				const heading = within(detail).queryByRole('heading', { level: 4, name: label });
				if (work[field]?.length) {
					expect(heading).toBeInTheDocument();
				} else {
					expect(heading).not.toBeInTheDocument();
				}
			}
		}
	});

	it('プロフィールと作品の外部リンクを通常のアンカーとして表示する', () => {
		render(Page);

		const githubLinks = screen.getAllByRole('link', { name: /GitHub/ });
		expect(githubLinks.length).toBeGreaterThan(0);
		for (const link of githubLinks) {
			expect(link.getAttribute('href')).toMatch(/^https:\/\//);
		}
	});

	it('空白を含むスキル分類名でも安全な ID で見出しを関連付ける', () => {
		const originalProfile = content.profile;
		content.profile = {
			...originalProfile,
			skills: [{ label: 'Front End', items: [{ name: 'TypeScript' }] }]
		};

		try {
			render(Page);

			const heading = screen.getByRole('heading', { level: 4, name: 'Front End' });
			const group = heading.closest('section');
			expect(heading.id).toMatch(/^skill-group-\d+$/);
			expect(heading.id).not.toContain(' ');
			expect(group).toHaveAttribute('aria-labelledby', heading.id);
		} finally {
			content.profile = originalProfile;
		}
	});

	it('任意フィールドをすべて省略しても必須情報を表示できる', () => {
		const originalProfile = content.profile;
		const originalWorks = content.works;

		content.profile = {
			sections: originalProfile.sections,
			sectionLabels: originalProfile.sectionLabels,
			workMetaLabels: originalProfile.workMetaLabels,
			career: [{ period: '2026', title: 'テスト経歴' }],
			expertise: [{ title: 'テスト領域', description: 'テスト説明' }],
			skills: [{ label: 'テスト分類', items: [{ name: 'テストスキル' }] }],
			workingStyle: ['テストスタイル']
		};
		content.works = [{ id: 'minimal-work', title: '最小作品', blurb: '必須項目のみ', hue: 0 }];

		try {
			render(Page);

			expect(screen.getByRole('heading', { name: 'テスト経歴' })).toBeInTheDocument();
			expect(screen.getByRole('heading', { name: 'テスト領域' })).toBeInTheDocument();
			expect(screen.getByText('テストスキル')).toBeInTheDocument();
			expect(screen.getByText('テストスタイル')).toBeInTheDocument();
			expect(screen.getByRole('heading', { name: '最小作品' })).toBeInTheDocument();
			expect(screen.queryByRole('link', { name: /GitHub/ })).not.toBeInTheDocument();
			expect(document.querySelector('#work-minimal-work dl')).toBeNull();
			expect(document.querySelectorAll('#work-minimal-work h4')).toHaveLength(0);
		} finally {
			content.profile = originalProfile;
			content.works = originalWorks;
		}
	});
});
