import { describe, expect, it, vi } from 'vitest';
import { handDrawnSequence, resolveHandPosition } from './handDrawnSequence';

function media(matches: boolean) {
	return {
		matches,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	} as unknown as MediaQueryList;
}

describe('handDrawnSequence', () => {
	it('ペン先が描画対象の右下に一致するよう手の左上座標を補正する', () => {
		expect(
			resolveHandPosition({ left: 100, right: 500, bottom: 300 }, { width: 112, height: 88 })
		).toEqual({
			startX: 97,
			x: 481,
			y: 208
		});
		expect(
			resolveHandPosition({ left: 100, right: 500, bottom: 300 }, { width: 80, height: 440 / 7 })
		).toEqual({ startX: 100.14285714285714, x: 484.14285714285717, y: 232 });
	});

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
		expect(root.dataset.drawingState).toBeUndefined();
		expect(root.querySelector<HTMLElement>('[data-draw-step]')?.inert).toBe(false);
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
		root.innerHTML =
			'<p data-draw-step="eyebrow"><a href="/profile">work</a></p><i data-drawing-hand></i>';

		const detach = handDrawnSequence()(root);
		expect(root.dataset.drawingState).toBe('active');
		expect(root.querySelector<HTMLElement>('[data-draw-step]')?.inert).toBe(true);
		expect(sessionStorage.getItem('atf:showcase-hand-drawn:v1')).toBe('1');
		const onChange = vi.mocked(preference.addEventListener).mock.calls[0]?.[1];
		if (typeof onChange === 'function') onChange({ matches: true } as MediaQueryListEvent);
		expect(root.dataset.drawingState).toBe('skipped');
		expect(root.querySelector<HTMLElement>('[data-draw-step]')?.inert).toBe(false);
		expect(preference.removeEventListener).toHaveBeenCalledWith('change', onChange);
		expect(disconnect).toHaveBeenCalled();
		detach?.();
		expect(root.dataset.drawingState).toBeUndefined();
	});
});
