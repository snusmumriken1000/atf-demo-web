/*
 * jsdom(client プロジェクト)用のテストセットアップ。
 * jsdom にはない matchMedia / IntersectionObserver の最小スタブを用意する。
 * 挙動を変えたいテストは vi.stubGlobal で上書きすること。
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';

afterEach(cleanup);

// 既定は「reduced-motion ではない」を返す
vi.stubGlobal(
	'matchMedia',
	vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
);

// 既定は「何も交差しない」no-op の IntersectionObserver
vi.stubGlobal(
	'IntersectionObserver',
	class {
		root = null;
		rootMargin = '';
		thresholds = [];
		observe() {}
		unobserve() {}
		disconnect() {}
		takeRecords() {
			return [];
		}
	}
);
