import { describe, expect, it } from 'vitest';
import type { Note } from './chillScore';
import { asAudioContext, FakeAudioContext } from './fakeAudioContext';
import { SpatialAudioEngine } from './spatialAudioEngine';

const note = (overrides: Partial<Note> = {}): Note => ({
	slot: 'rhythm',
	kind: 'key',
	frequency: 440,
	time: 0,
	duration: 0.9,
	level: 1,
	...overrides
});

const setup = (options: { legacy?: boolean; state?: AudioContextState } = {}) => {
	const context = new FakeAudioContext(options);
	const engine = new SpatialAudioEngine(asAudioContext(context), 0.5);
	engine.addSlot('rhythm');
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

	it('スロットは HRTF の PannerNode を持つ', () => {
		const { context } = setup();
		expect(context.panners[0].panningModel).toBe('HRTF');
	});

	it('同じ id のスロットを二重に作らない', () => {
		const { context, engine } = setup();
		engine.addSlot('rhythm');

		expect(engine.slotIds).toEqual(['rhythm']);
		expect(context.panners).toHaveLength(1);
	});

	it('スロットの位置を AudioParam に反映する', () => {
		const { context, engine } = setup();
		engine.setSlotPosition('rhythm', { x: 1.5, y: -0.5, z: -2 });

		const panner = context.panners[0];
		expect([panner.positionX?.value, panner.positionY?.value, panner.positionZ?.value]).toEqual([
			1.5, -0.5, -2
		]);
	});

	it('AudioParam を持たない古い実装では setPosition にフォールバックする', () => {
		const { context, engine } = setup({ legacy: true });
		engine.setSlotPosition('rhythm', { x: 1, y: 2, z: -3 });

		expect(context.panners[0].legacyPosition).toEqual({ x: 1, y: 2, z: -3 });
	});

	it('存在しないスロットを指定しても落ちない', () => {
		const { engine } = setup();
		expect(() => {
			engine.setSlotPosition('missing', { x: 0, y: 0, z: -1 });
			engine.setSlotLevel('missing', 1.5);
			engine.triggerNote(note({ slot: 'missing' }), 0);
		}).not.toThrow();
	});

	it('スロットの音量倍率を反映する', () => {
		const { context, engine } = setup();
		engine.setSlotLevel('rhythm', 1.6);

		const applied = context.gains.some((gain) =>
			gain.gain.calls.some((call) => call.method === 'setTargetAtTime' && call.value === 1.6)
		);
		expect(applied).toBe(true);
	});

	it('指定した時刻に音符を鳴らし、鳴り終わりに合わせて停止を予約する', () => {
		const { context, engine } = setup();
		engine.triggerNote(note({ kind: 'bass', duration: 1.2 }), 3);

		const started = context.oscillators.filter((oscillator) => oscillator.started === 1);
		expect(started.length).toBeGreaterThan(0);
		expect(started.every((oscillator) => oscillator.startedAt === 3)).toBe(true);
		expect(started.every((oscillator) => (oscillator.stoppedAt ?? 0) >= 4.2)).toBe(true);
	});

	it('キック・スネア・ハイハット・ベース・パッド・キーをそれぞれ違う作りで鳴らす', () => {
		const { context, engine } = setup();
		const before = { osc: 0, noise: 0 };
		const counts: Record<string, { osc: number; noise: number }> = {};

		for (const kind of ['kick', 'snare', 'hat', 'bass', 'pad', 'key'] as const) {
			engine.triggerNote(note({ kind }), 0);
			counts[kind] = {
				osc: context.oscillators.length - before.osc,
				noise: context.bufferSources.length - before.noise
			};
			before.osc = context.oscillators.length;
			before.noise = context.bufferSources.length;
		}

		// 打楽器のうちスネアとハイハットはノイズ、それ以外はオシレータで作る
		expect(counts.snare.noise).toBe(1);
		expect(counts.hat.noise).toBe(1);
		expect(counts.kick).toEqual({ osc: 1, noise: 0 });
		expect(counts.bass).toEqual({ osc: 2, noise: 0 });
		expect(counts.pad).toEqual({ osc: 2, noise: 0 });
		expect(counts.key).toEqual({ osc: 3, noise: 0 });
	});

	it('キックはピッチを落として胴のある低音にする', () => {
		const { context, engine } = setup();
		engine.triggerNote(note({ kind: 'kick', frequency: 140 }), 0);

		const drop = context.oscillators[0].frequency.calls.at(-1);
		expect(drop?.method).toBe('exponentialRampToValueAtTime');
		expect(drop?.value).toBeLessThan(140);
	});

	it('鳴り終わった音符のノードを切り離す(鳴らし続けても増え続けない)', () => {
		const { context, engine } = setup();
		engine.triggerNote(note({ kind: 'key' }), 0);
		const voices = context.oscillators.filter((oscillator) => oscillator.started === 1);

		voices.at(-1)?.finish();
		expect(voices.every((oscillator) => oscillator.disconnected > 0)).toBe(true);
	});

	it('環境音は常時ループで鳴らす', () => {
		const { context, engine } = setup();
		engine.startAmbience('rhythm', 780);

		expect(context.bufferSources).toHaveLength(1);
		expect(context.bufferSources[0].loop).toBe(true);
		expect(context.bufferSources[0].started).toBe(1);
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

	it('dispose で鳴っている音を止めて AudioContext を閉じる', async () => {
		const { context, engine } = setup();
		engine.startAmbience('rhythm', 780);
		engine.triggerNote(note({ kind: 'pad', duration: 3 }), 0);
		await engine.dispose();

		expect(context.oscillators.every((oscillator) => oscillator.stopped >= 1)).toBe(true);
		expect(context.bufferSources.every((source) => source.stopped >= 1)).toBe(true);
		expect(context.closed).toBe(1);
		expect(engine.slotIds).toEqual([]);
	});

	it('dispose 後の操作は何もしない(二重解放しない)', async () => {
		const { context, engine } = setup();
		await engine.dispose();
		await engine.dispose();
		engine.addSlot('rhythm');
		engine.triggerNote(note(), 0);

		expect(context.closed).toBe(1);
		expect(engine.slotIds).toEqual([]);
	});
});
