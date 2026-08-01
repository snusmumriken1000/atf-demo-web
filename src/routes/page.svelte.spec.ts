import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import Page from './+page.svelte';

const basePath = process.env.BASE_PATH ?? '';

describe('入口ページ(/)', () => {
	it('面の選択 nav に 2 つの面へのリンクがある', () => {
		render(Page);

		const nav = screen.getByRole('navigation', { name: '面の選択' });
		const links = within(nav).getAllByRole('link');

		expect(links).toHaveLength(2);
		expect(links[0]).toHaveAttribute('href', `${basePath}/showcase`);
		expect(links[1]).toHaveAttribute('href', `${basePath}/profile`);
	});
});
