import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FaceSwitcher from './FaceSwitcher.svelte';

// $app/state の page をテストごとに差し替えるためモックする(route.id のみ使用)
const mockPage = vi.hoisted(() => ({ route: { id: '/showcase' as string | null } }));
vi.mock('$app/state', () => ({ page: mockPage }));

describe('FaceSwitcher', () => {
	it.each([
		['/showcase', ['Profile', 'Ask'], ['/profile', '/ask']],
		['/profile', ['Showcase', 'Ask'], ['/showcase', '/ask']],
		['/ask', ['Showcase', 'Profile'], ['/showcase', '/profile']]
	])('%s では入口へ戻るリンクと、他の面へのリンクを出す', (route, labels, hrefs) => {
		mockPage.route.id = route;
		render(FaceSwitcher);

		expect(screen.getByRole('link', { name: '← Top' })).toHaveAttribute('href', '/');
		for (const [index, label] of labels.entries()) {
			expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', hrefs[index]);
		}
	});

	it('いま見ている面へのリンクは出さない', () => {
		mockPage.route.id = '/ask';
		render(FaceSwitcher);

		expect(screen.queryByRole('link', { name: 'Ask' })).not.toBeInTheDocument();
	});
});
