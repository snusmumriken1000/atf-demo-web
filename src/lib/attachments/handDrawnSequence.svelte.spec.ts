import { describe, expect, it, vi } from 'vitest';
import { handDrawnSequence } from './handDrawnSequence';

function media(matches: boolean) {
	return {
		matches,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	} as unknown as MediaQueryList;
}

describe('handDrawnSequence', () => {
	it('reduced-motionではDOMを隠さずskippedにする', () => {
		const preference = media(true);
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => preference)
		);
		const root = document.createElement('section');
		root.innerHTML = '<p data-draw-step="eyebrow"></p>';

		const detach = handDrawnSequence()(root);
		expect(root.dataset.drawingState).toBe('skipped');
		expect(root.querySelector('[data-draw-step]')).toHaveClass('drawn');
		detach?.();
		expect(preference.removeEventListener).toHaveBeenCalled();
	});

	it('初回だけactiveにし、detachでobserverと状態を片付ける', () => {
		sessionStorage.clear();
		const preference = media(false);
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => preference)
		);
		const disconnect = vi.fn();
		vi.stubGlobal(
			'ResizeObserver',
			vi.fn().mockImplementation(function () {
				return { observe: vi.fn(), disconnect };
			})
		);
		const root = document.createElement('section');
		root.innerHTML = '<p data-draw-step="eyebrow"></p><i data-drawing-hand></i>';

		const detach = handDrawnSequence()(root);
		expect(root.dataset.drawingState).toBe('active');
		expect(sessionStorage.getItem('atf:showcase-hand-drawn:v1')).toBe('1');
		const onChange = vi.mocked(preference.addEventListener).mock.calls[0]?.[1];
		if (typeof onChange === 'function') onChange({ matches: true } as MediaQueryListEvent);
		expect(root.dataset.drawingState).toBe('skipped');
		detach?.();
		expect(root.dataset.drawingState).toBeUndefined();
		expect(disconnect).toHaveBeenCalled();
	});
});
