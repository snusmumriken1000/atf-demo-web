import { describe, expect, it } from 'vitest';
import { asAudioContext, FakeAudioContext } from './fakeAudioContext';
import { SpatialAudioEngine, type SpatialSourceSpec } from './spatialAudioEngine';

const TONE: SpatialSourceSpec = { id: 'work-a', kind: 'tone', frequency: 220 };
const DRONE: SpatialSourceSpec = { id: 'hero', kind: 'drone', frequency: 65 };
const AIR: SpatialSourceSpec = { id: 'air', kind: 'air', frequency: 780 };

const setup = (options: { legacy?: boolean; state?: AudioContextState } = {}) => {
	const context = new FakeAudioContext(options);
	const engine = new SpatialAudioEngine(asAudioContext(context), 0.5);
	return { context, engine };
};

describe('SpatialAudioEngine', () => {
	it('生成直後は無音(master gain が実質 0)', () => {
		const { context } = setup();
		// 最初に作られる GainNode が master
		expect(context.gains[0].gain.value).toBeLessThan(0.001);
	});

	it('残響のインパルス応答をコードで生成して繋ぐ(音声ファイルを読み込まない)', () => {
		const { context } = setup();
		const convolver = context.convolvers[0];

		expect(convolver.buffer).not.toBeNull();
		expect((convolver.buffer as { length: number }).length).toBeGreaterThan(0);
	});

	it('音源を足すと HRTF の PannerNode 経由で鳴り始める', () => {
		const { context, engine } = setup();
		engine.addSource(TONE);

		const panner = context.panners[0];
		expect(panner.panningModel).toBe('HRTF');
		expect(context.oscillators.every((oscillator) => oscillator.started === 1)).toBe(true);
	});

	it('トーンは基音と倍音の 2 声、空気感はノイズで作る', () => {
		const { context, engine } = setup();
		engine.addSource(TONE);
		const tonePartials = context.oscillators.filter(
			(oscillator) => oscillator.frequency.value >= 220
		);
		engine.addSource(AIR);

		expect(tonePartials.length).toBe(2);
		expect(context.bufferSources).toHaveLength(1);
		expect(context.bufferSources[0].loop).toBe(true);
	});

	it('同じ id を二重に登録しない', () => {
		const { context, engine } = setup();
		engine.addSource(TONE);
		engine.addSource({ ...TONE, frequency: 999 });

		expect(engine.sourceIds).toEqual(['work-a']);
		expect(context.panners).toHaveLength(1);
	});

	it('音源の位置を AudioParam に反映する', () => {
		const { context, engine } = setup();
		engine.addSource(TONE);
		engine.setSourcePosition('work-a', { x: 1.5, y: -0.5, z: -2 });

		const panner = context.panners[0];
		expect([panner.positionX?.value, panner.positionY?.value, panner.positionZ?.value]).toEqual([
			1.5, -0.5, -2
		]);
	});

	it('AudioParam を持たない古い実装では setPosition にフォールバックする', () => {
		const { context, engine } = setup({ legacy: true });
		engine.addSource(TONE);
		engine.setSourcePosition('work-a', { x: 1, y: 2, z: -3 });

		expect(context.panners[0].legacyPosition).toEqual({ x: 1, y: 2, z: -3 });
	});

	it('存在しない id を指定しても落ちない', () => {
		const { engine } = setup();
		expect(() => {
			engine.setSourcePosition('missing', { x: 0, y: 0, z: -1 });
			engine.setSourceLevel('missing', 1.5);
		}).not.toThrow();
	});

	it('音量倍率を levelGain に反映する', () => {
		const { context, engine } = setup();
		engine.addSource(TONE);
		engine.setSourceLevel('work-a', 1.6);

		const applied = context.gains.some((gain) =>
			gain.gain.calls.some((call) => call.method === 'setTargetAtTime' && call.value === 1.6)
		);
		expect(applied).toBe(true);
	});

	it('リスナーの位置と向きを反映する', () => {
		const { context, engine } = setup();
		engine.setListener({
			position: { x: 0.5, y: -0.2, z: 0 },
			forward: { x: 0.3, y: 0.1, z: -0.95 },
			up: { x: 0, y: 1, z: 0 }
		});

		const listener = context.listener;
		expect(listener.positionX?.value).toBeCloseTo(0.5, 5);
		expect(listener.forwardZ?.value).toBeCloseTo(-0.95, 5);
		expect(listener.upY?.value).toBe(1);
	});

	it('古い実装のリスナーには setOrientation / setPosition を使う', () => {
		const { context, engine } = setup({ legacy: true });
		engine.setListener({
			position: { x: 1, y: 0, z: 0 },
			forward: { x: 0, y: 0, z: -1 },
			up: { x: 0, y: 1, z: 0 }
		});

		expect(context.listener.legacyPosition).toEqual({ x: 1, y: 0, z: 0 });
		expect(context.listener.legacyOrientation).toEqual([0, 0, -1, 0, 1, 0]);
	});

	it('fadeIn で指定音量まで上げ、fadeOut で無音へ戻す', async () => {
		const { context, engine } = setup();
		await engine.fadeIn();
		const master = context.gains[0];
		expect(master.gain.calls.at(-1)).toEqual({
			method: 'linearRampToValueAtTime',
			value: 0.5
		});

		await engine.fadeOut();
		expect(master.gain.calls.at(-1)?.value).toBeLessThan(0.001);
	});

	it('suspended の状態で fadeIn すると resume する(自動再生制限からの復帰)', async () => {
		const { context, engine } = setup({ state: 'suspended' });
		await engine.fadeIn();

		expect(context.resumed).toBe(1);
		expect(context.state).toBe('running');
	});

	it('タブが隠れたら suspend し、戻ったら resume する', async () => {
		const { context, engine } = setup();
		await engine.suspend();
		expect(context.suspended).toBe(1);

		await engine.resume();
		expect(context.state).toBe('running');
	});

	it('dispose で全音源を止めて AudioContext を閉じる', async () => {
		const { context, engine } = setup();
		engine.addSource(DRONE);
		engine.addSource(AIR);
		await engine.dispose();

		expect(context.oscillators.every((oscillator) => oscillator.stopped === 1)).toBe(true);
		expect(context.bufferSources.every((source) => source.stopped === 1)).toBe(true);
		expect(context.closed).toBe(1);
		expect(engine.sourceIds).toEqual([]);
	});

	it('dispose 後の操作は何もしない(二重解放しない)', async () => {
		const { context, engine } = setup();
		await engine.dispose();
		await engine.dispose();
		engine.addSource(TONE);

		expect(context.closed).toBe(1);
		expect(engine.sourceIds).toEqual([]);
	});
});
