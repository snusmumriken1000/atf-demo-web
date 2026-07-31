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
});
