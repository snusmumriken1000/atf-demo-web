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

	it('setItemだけ失敗してgetItemがnullでもfallbackし、操作可能なcardだけをinertにする', () => {
		sessionStorage.clear();
		window.name = '';
		const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
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
			'<h1 data-draw-step="statement-1">Accessible heading</h1><article data-draw-step="work-1" data-draw-kind="card"><a href="/profile">work</a></article><i data-drawing-hand></i>';

		const detach = handDrawnSequence()(root);
		expect(root.dataset.drawingState).toBe('active');
		expect(root.querySelector<HTMLElement>('h1')?.inert).not.toBe(true);
		expect(root.querySelector<HTMLElement>('[data-draw-kind="card"]')?.inert).toBe(true);
		expect(root.querySelector('h1')).toHaveAccessibleName('Accessible heading');
		expect(sessionStorage.getItem('atf:showcase-hand-drawn:v1')).toBeNull();
		expect(window.name).toContain('atf:showcase-hand-drawn:v1');
		setItem.mockRestore();
		const revisit = document.createElement('section');
		revisit.innerHTML = '<p data-draw-step="lead">revisit</p>';
		const detachRevisit = handDrawnSequence()(revisit);
		expect(revisit.dataset.drawingState).toBe('skipped');
		detachRevisit?.();
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
