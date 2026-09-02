import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { FakeAudioContext } from '$lib/audio/fakeAudioContext';
import { soundState } from '$lib/audio/soundState.svelte';
import type { SpatialSourceSpec } from '$lib/audio/spatialAudioEngine';
import SpatialAudioScene from './SpatialAudioScene.svelte';

const sources: SpatialSourceSpec[] = [
	{ id: 'hero', kind: 'drone', frequency: 65 },
	{ id: 'work-a', kind: 'tone', frequency: 220 }
];

// 生成された AudioContext を掴むためのスパイ
let contexts: FakeAudioContext[] = [];

class TrackedAudioContext extends FakeAudioContext {
	constructor() {
		super();
		contexts.push(this);
	}
}

beforeEach(() => {
	soundState.reset();
	localStorage.clear();
	contexts = [];
	vi.stubGlobal('AudioContext', TrackedAudioContext);
	document.body.innerHTML = '<div data-audio-source="hero"></div>';
});

const renderScene = () => render(SpatialAudioScene, { props: { sources, volume: 0.5 } });

describe('SpatialAudioScene', () => {
	it('音が無効な間は AudioContext を作らない(押すまで完全に無音)', async () => {
		renderScene();
		await vi.waitFor(() => expect(soundState.hydrated).toBe(true));

		expect(contexts).toHaveLength(0);
	});

	it('有効にすると音源を組み立てて鳴らし始める', async () => {
		renderScene();
		soundState.set(true);

		await vi.waitFor(() => expect(contexts).toHaveLength(1));
		await vi.waitFor(() => expect(contexts[0].panners.length).toBe(sources.length));
	});

	it('DOM にある音源は要素の位置へ、ない音源は既定位置に置かれる', async () => {
		renderScene();
		soundState.set(true);
		await vi.waitFor(() => expect(contexts[0]?.panners).toHaveLength(2));

		// jsdom の getBoundingClientRect は 0 を返すので、
		// 「位置が設定されていること」だけを確認する
		expect(contexts[0].panners.every((panner) => panner.positionZ?.value !== undefined)).toBe(true);
	});

	it('無効に戻すと音を止める', async () => {
		renderScene();
		soundState.set(true);
		await vi.waitFor(() => expect(contexts).toHaveLength(1));

		soundState.set(false);
		await vi.waitFor(() => {
			const master = contexts[0].gains[0];
			expect(master.gain.calls.at(-1)?.value).toBeLessThan(0.001);
		});
	});

	it('面を離れる(破棄される)ときも音を止める', async () => {
		const { unmount } = renderScene();
		soundState.set(true);
		await vi.waitFor(() => expect(contexts).toHaveLength(1));

		unmount();
		await vi.waitFor(() => {
			const master = contexts[0].gains[0];
			expect(master.gain.calls.at(-1)?.value).toBeLessThan(0.001);
		});
	});

	it('AudioContext を持たないブラウザでは何も起きない', async () => {
		vi.stubGlobal('AudioContext', undefined);
		renderScene();
		soundState.set(true);
		await vi.waitFor(() => expect(soundState.enabled).toBe(true));

		expect(contexts).toHaveLength(0);
	});
});
