import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { content } from '$lib/data/content';
import Page from './+page.svelte';

describe('showcase ページ(/showcase)', () => {
	it('架空のモックコンテンツである旨を表示する', () => {
		render(Page);
		expect(screen.getByText(content.site.mockNotice)).toBeInTheDocument();
	});

	it('ステートメント(h1)が描画される', () => {
		render(Page);

		expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
	});

	it('content.ts の featured 作品を最大 4 件表示し、Profile 詳細へリンクする', () => {
		const { container } = render(Page);

		const tiles = container.querySelectorAll('.works li');
		const featuredCount = content.works.filter((work) => work.featured).length;
		expect(tiles).toHaveLength(Math.min(featuredCount || content.works.length, 4));
		const expected = (
			featuredCount ? content.works.filter((work) => work.featured) : content.works
		).slice(0, 4);
		expect([...tiles].map((tile) => tile.querySelector('h3')?.textContent)).toEqual(
			expected.map((work) => work.title)
		);
		for (const work of expected) {
			const link = screen.getByRole('link', { name: new RegExp(work.title) });
			expect(link).toHaveAttribute('href', `/profile#work-${work.id}`);
			expect(link).toHaveTextContent(work.blurb);
		}
	});

	it('初期マークアップのタイルは hidden クラス(fade-pending)を持たない', () => {
		// reduced-motion を真にして attachment を no-op にすると、
		// マークアップ自体が可視(hidden クラスなし)であることを検証できる
		// = JS 無効環境でもコンテンツが不可視にならないことの担保
		vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
		const { container } = render(Page);

		expect(container.querySelector('.fade-pending')).toBeNull();
	});

	it('手描き工程と装飾用の手をsemanticを変えずに配置する', () => {
		vi.stubGlobal(
			'matchMedia',
			vi
				.fn()
				.mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
		);
		const { container } = render(Page);
		const steps = container.querySelectorAll('[data-draw-step]');
		expect(steps.length).toBeGreaterThanOrEqual(10);
		expect(container.querySelector('[data-drawing-hand]')).toHaveAttribute('aria-hidden', 'true');
		expect(container.querySelectorAll('[data-draw-path]').length).toBe(steps.length);
		expect(container.querySelectorAll('[data-draw-kind="card"]')).toHaveLength(4);
		expect(container.querySelectorAll('.outlining')).toHaveLength(4);
		expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
	});
});
