import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FaceSwitcher from './FaceSwitcher.svelte';

// $app/state の page をテストごとに差し替えるためモックする(route.id のみ使用)
const mockPage = vi.hoisted(() => ({ route: { id: '/showcase' as string | null } }));
vi.mock('$app/state', () => ({ page: mockPage }));
const basePath = process.env.BASE_PATH ?? '';

describe('FaceSwitcher', () => {
	it('showcase では入口へ戻るリンクと Profile へのリンクを出す', () => {
		mockPage.route.id = '/showcase';
		render(FaceSwitcher);

		expect(screen.getByRole('link', { name: '← Top' })).toHaveAttribute('href', `${basePath}/`);
		expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
			'href',
			`${basePath}/profile`
		);
	});

	it('profile では入口へ戻るリンクと Showcase へのリンクを出す', () => {
		mockPage.route.id = '/profile';
		render(FaceSwitcher);

		expect(screen.getByRole('link', { name: '← Top' })).toHaveAttribute('href', `${basePath}/`);
		expect(screen.getByRole('link', { name: 'Showcase' })).toHaveAttribute(
			'href',
			`${basePath}/showcase`
		);
	});
});
