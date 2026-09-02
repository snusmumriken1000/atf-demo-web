import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { FakeAudioContext } from '$lib/audio/fakeAudioContext';
import { soundState } from '$lib/audio/soundState.svelte';
import SpatialAudioScene from './SpatialAudioScene.svelte';

const tiles = [
	{ id: 'work-a', hue: 215 },
	{ id: 'work-b', hue: 20 }
];
// 固定スロット 5 + ヒーロー 1 + 作品タイル
const EXPECTED_SLOTS = 6 + tiles.length;

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

const renderScene = () =>
	render(SpatialAudioScene, {
		props: { tiles, bpm: 74, baseHz: 130.81, octaveRange: 2, volume: 0.5 }
	});

describe('SpatialAudioScene', () => {
	it('音が無効な間は AudioContext を作らない(押すまで完全に無音)', async () => {
		renderScene();
		await vi.waitFor(() => expect(soundState.hydrated).toBe(true));

		expect(contexts).toHaveLength(0);
	});

	it('有効にすると役割ごとのスロットを組み立てる', async () => {
		renderScene();
		soundState.set(true);

		await vi.waitFor(() => expect(contexts).toHaveLength(1));
		await vi.waitFor(() => expect(contexts[0].panners.length).toBe(EXPECTED_SLOTS));
	});

	it('すべてのスロットに 3D 位置が設定される', async () => {
		renderScene();
		soundState.set(true);
		await vi.waitFor(() => expect(contexts[0]?.panners).toHaveLength(EXPECTED_SLOTS));

		// jsdom の getBoundingClientRect は 0 を返すので、
		// 「位置が設定されていること」だけを確認する
		expect(contexts[0].panners.every((panner) => panner.positionZ?.value !== undefined)).toBe(true);
	});

	it('有効にすると曲が流れ始める(音符が予約される)', async () => {
		renderScene();
		soundState.set(true);

		// キックやパッドのオシレータが先読みで予約される
		await vi.waitFor(() => expect(contexts[0]?.oscillators.length ?? 0).toBeGreaterThan(0));
		expect(contexts[0].oscillators.every((oscillator) => oscillator.started === 1)).toBe(true);
	});

	it('レコードノイズのような環境音を常時鳴らす', async () => {
		renderScene();
		soundState.set(true);

		await vi.waitFor(() => expect(contexts[0]?.bufferSources.length ?? 0).toBeGreaterThan(0));
		expect(contexts[0].bufferSources[0].loop).toBe(true);
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
