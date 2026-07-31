import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import { content } from '$lib/data/content';
import Page from './+page.svelte';

describe('profile ページ(/profile)', () => {
	it('自己紹介・経歴・スキル・作品を content.ts の内容で表示する', () => {
		render(Page);

		expect(screen.getByRole('heading', { level: 1, name: content.hero.name })).toBeInTheDocument();
		expect(screen.getAllByRole('listitem')).toHaveLength(
			content.profile.career.length +
				content.profile.skills.reduce((sum, group) => sum + group.items.length, 0)
		);

		for (const work of content.works) {
			const detail = document.querySelector(`#work-${work.id}`);
			expect(detail).not.toBeNull();
			expect(
				within(detail as HTMLElement).getByRole('heading', { name: work.title })
			).toBeInTheDocument();
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

			const heading = screen.getByRole('heading', { level: 3, name: 'Front End' });
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
			sectionLabels: originalProfile.sectionLabels,
			workMetaLabels: originalProfile.workMetaLabels,
			career: [{ period: '2026', title: 'テスト経歴' }],
			skills: [{ label: 'テスト分類', items: [{ name: 'テストスキル' }] }]
		};
		content.works = [{ id: 'minimal-work', title: '最小作品', blurb: '必須項目のみ', hue: 0 }];

		try {
			render(Page);

			expect(screen.getByRole('heading', { name: 'テスト経歴' })).toBeInTheDocument();
			expect(screen.getByText('テストスキル')).toBeInTheDocument();
			expect(screen.getByRole('heading', { name: '最小作品' })).toBeInTheDocument();
			expect(screen.queryByRole('link', { name: /GitHub/ })).not.toBeInTheDocument();
			expect(document.querySelector('#work-minimal-work dl')).toBeNull();
		} finally {
			content.profile = originalProfile;
			content.works = originalWorks;
		}
	});
});
