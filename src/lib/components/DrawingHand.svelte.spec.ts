import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import DrawingHand from './DrawingHand.svelte';

describe('DrawingHand', () => {
	it('低彩度の線画による製図用ペンとして装飾的に描画する', () => {
		const { container } = render(DrawingHand);
		const hand = container.querySelector('[data-drawing-hand]');

		expect(hand).toHaveAttribute('data-drawing-tool', 'technical-pen');
		expect(hand).toHaveAttribute('aria-hidden', 'true');
		expect(container.querySelector('svg')).toHaveAttribute('role', 'presentation');
		expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 112 88');
		expect(container.querySelector('.pen-body')).toBeInTheDocument();
		expect(container.querySelector('.nib')).toBeInTheDocument();
		expect(container.querySelectorAll('.finger-line')).toHaveLength(3);
		expect(container.querySelector('.hand')).not.toBeInTheDocument();
		expect(container.querySelector('.pen')).not.toBeInTheDocument();
	});
});
