import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { Work } from '$lib/data/content.types';
import WorkTile from './WorkTile.svelte';

const work: Work = {
	id: 'sample-work',
	title: 'Sample Work',
	blurb: '一行説明',
	hue: 200,
	role: '担当',
	tech: ['Svelte'],
	period: '2026',
	context: ['背景'],
	approach: ['方法'],
	outcome: ['成果']
};

describe('WorkTile', () => {
	it('image 省略時は装飾扱いのプレースホルダビジュアルを出す', () => {
		const { container } = render(WorkTile, { work });

		const placeholder = container.querySelector('.visual.placeholder');
		expect(placeholder).not.toBeNull();
		// グラデーションは装飾なので支援技術からは隠す
		expect(placeholder).toHaveAttribute('aria-hidden', 'true');
		expect(container.querySelector('img')).toBeNull();
	});

	it('image 指定時は <img> に置き換わる', () => {
		render(WorkTile, { work, image: '/sample.png', imageAlt: 'サンプル' });

		const img = screen.getByRole('img', { name: 'サンプル' });
		expect(img).toHaveAttribute('src', '/sample.png');
	});

	it('href 指定時はタイル全体がリンクになり、省略時はリンクを出さない', () => {
		const { unmount } = render(WorkTile, { work, href: '/showcase' });

		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', '/showcase');
		// リンク内に作品名が含まれる(タイル全体がリンク)
		expect(link).toHaveTextContent('Sample Work');
		unmount();

		const { container: plain } = render(WorkTile, { work });
		expect(plain.querySelector('a')).toBeNull();
	});
});
