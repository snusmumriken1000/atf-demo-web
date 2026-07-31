import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { works } from '$lib/data/works';
import Page from './+page.svelte';

describe('showcase ページ(/showcase)', () => {
	it('ステートメント(h1)が描画される', () => {
		render(Page);

		expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
	});

	it('works.ts の件数どおり作品タイルが出る', () => {
		const { container } = render(Page);

		const tiles = container.querySelectorAll('.works li');
		expect(tiles).toHaveLength(works.length);
	});

	it('初期マークアップのタイルは hidden クラス(fade-pending)を持たない', () => {
		// reduced-motion を真にして attachment を no-op にすると、
		// マークアップ自体が可視(hidden クラスなし)であることを検証できる
		// = JS 無効環境でもコンテンツが不可視にならないことの担保
		vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
		const { container } = render(Page);

		expect(container.querySelector('.fade-pending')).toBeNull();
	});
});
