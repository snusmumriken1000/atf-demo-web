import { describe, expect, it, vi } from 'vitest';
import { fadeInOnView } from './fadeInOnView';

describe('fadeInOnView', () => {
	it('JS 実行後に hidden クラスを付け、交差でフェードイン(クラス除去)する', () => {
		let intersect: IntersectionObserverCallback | undefined;
		const observe = vi.fn();
		const unobserve = vi.fn();
		const disconnect = vi.fn();
		vi.stubGlobal(
			'IntersectionObserver',
			vi.fn().mockImplementation(function (callback: IntersectionObserverCallback) {
				intersect = callback;
				return { observe, unobserve, disconnect };
			})
		);

		const element = document.createElement('div');
		const detach = fadeInOnView()(element);

		// attach 時: hidden クラスが付き、observe される
		expect(element.classList.contains('fade-target')).toBe(true);
		expect(element.classList.contains('fade-pending')).toBe(true);
		expect(observe).toHaveBeenCalledWith(element);

		// 交差: hidden クラスが外れてフェードイン、observe 解除
		intersect?.(
			[{ isIntersecting: true, target: element } as unknown as IntersectionObserverEntry],
			{} as IntersectionObserver
		);
		expect(element.classList.contains('fade-pending')).toBe(false);
		expect(unobserve).toHaveBeenCalledWith(element);

		// detach 時: observer を破棄し、クラスを片付ける
		detach?.();
		expect(disconnect).toHaveBeenCalled();
		expect(element.classList.length).toBe(0);
	});

	it('reduced-motion 時は何もしない(クラス付与も observe もなし)', () => {
		vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
		const observerConstructor = vi.fn();
		vi.stubGlobal('IntersectionObserver', observerConstructor);

		const element = document.createElement('div');
		fadeInOnView()(element);

		expect(element.classList.length).toBe(0);
		expect(observerConstructor).not.toHaveBeenCalled();
	});
});
