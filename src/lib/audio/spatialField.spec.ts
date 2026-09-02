import { describe, expect, it } from 'vitest';
import {
	clamp,
	hueToFrequency,
	listenerFromPointer,
	positionForRect,
	proximityLevel
} from './spatialField';

const viewport = { width: 1000, height: 800 };
const rectAt = (centerX: number, centerY: number) => ({
	left: centerX - 50,
	top: centerY - 25,
	width: 100,
	height: 50
});

describe('clamp', () => {
	it('範囲内はそのまま、範囲外は端に丸める', () => {
		expect([clamp(0.5, 0, 1), clamp(-2, 0, 1), clamp(3, 0, 1)]).toEqual([0.5, 0, 1]);
	});
});

describe('hueToFrequency', () => {
	it('hue 0 は基準の高さになる', () => {
		expect(hueToFrequency(0, 130.81, 2)).toBeCloseTo(130.81, 5);
	});

	it('色相が上がるほど音は高くなる(単調非減少)', () => {
		const frequencies = [0, 60, 120, 180, 240, 300, 359].map((hue) =>
			hueToFrequency(hue, 130.81, 2)
		);
		const sorted = [...frequencies].sort((a, b) => a - b);
		expect(frequencies).toEqual(sorted);
	});

	it('octaveRange で決めた音域を超えない', () => {
		const octaveRange = 2;
		const highest = hueToFrequency(359, 130.81, octaveRange);
		expect(highest).toBeLessThan(130.81 * Math.pow(2, octaveRange));
	});

	it('ペンタトニックの音度に量子化する(隣り合う色でも半音でぶつからない)', () => {
		const base = 100;
		const semitones = [0, 60, 120, 180, 240, 300, 359].map((hue) =>
			Math.round(12 * Math.log2(hueToFrequency(hue, base, 2) / base))
		);
		// 5 音音階(0,2,4,7,9)を 2 オクターブに広げた音度だけが現れる
		const allowed = new Set([0, 2, 4, 7, 9, 12, 14, 16, 19, 21]);
		expect(semitones.every((semitone) => allowed.has(semitone))).toBe(true);
	});

	it('360 以上・負の色相も 0〜360 に丸めて扱う', () => {
		expect(hueToFrequency(360, 130.81, 2)).toBeCloseTo(hueToFrequency(0, 130.81, 2), 5);
		expect(hueToFrequency(-40, 130.81, 2)).toBeCloseTo(hueToFrequency(320, 130.81, 2), 5);
	});
});

describe('positionForRect', () => {
	it('画面中央の要素は正面(x = 0)かつ最も近い', () => {
		const center = positionForRect(rectAt(500, 400), viewport);
		const edge = positionForRect(rectAt(500, 40), viewport);

		expect(center.x).toBeCloseTo(0, 5);
		expect(center.z).toBeGreaterThan(edge.z); // z は負なので大きいほど手前
	});

	it('左の要素は x が負、右の要素は x が正になる', () => {
		expect(positionForRect(rectAt(100, 400), viewport).x).toBeLessThan(0);
		expect(positionForRect(rectAt(900, 400), viewport).x).toBeGreaterThan(0);
	});

	it('画面上部の要素は音も上(y が正)に置かれる', () => {
		expect(positionForRect(rectAt(500, 100), viewport).y).toBeGreaterThan(0);
		expect(positionForRect(rectAt(500, 700), viewport).y).toBeLessThan(0);
	});

	it('音源は必ずリスナーの前方(z < 0)に置かれる', () => {
		const positions = [rectAt(0, 0), rectAt(1000, 800), rectAt(500, 400)].map((rect) =>
			positionForRect(rect, viewport)
		);
		expect(positions.every((position) => position.z < 0)).toBe(true);
	});

	it('画面外(スクロールで上下にはみ出した要素)でも左右の値が発散しない', () => {
		const far = positionForRect(rectAt(-4000, 9000), viewport);
		expect(Math.abs(far.x)).toBeLessThanOrEqual(3);
		expect(Math.abs(far.y)).toBeLessThanOrEqual(1.6);
	});

	it('ビューポートが 0 でも計算が壊れない(ゼロ除算しない)', () => {
		const position = positionForRect(rectAt(0, 0), { width: 0, height: 0 });
		expect(Number.isFinite(position.x + position.y + position.z)).toBe(true);
	});
});

describe('proximityLevel', () => {
	it('ポインタがないときは 1(持ち上げなし)', () => {
		expect(proximityLevel(rectAt(500, 400), null, viewport)).toBe(1);
	});

	it('ポインタが重なると最大まで持ち上がる', () => {
		expect(proximityLevel(rectAt(500, 400), { x: 500, y: 400 }, viewport)).toBeCloseTo(1.8, 5);
	});

	it('離れるほど 1 に近づき、遠方では 1 になる', () => {
		const near = proximityLevel(rectAt(500, 400), { x: 560, y: 430 }, viewport);
		const far = proximityLevel(rectAt(500, 400), { x: 980, y: 780 }, viewport);

		expect(near).toBeGreaterThan(far);
		expect(far).toBe(1);
	});
});

describe('listenerFromPointer', () => {
	it('ポインタがないときは正面固定の既定状態を返す', () => {
		const state = listenerFromPointer(null, viewport);
		expect(state.position).toEqual({ x: 0, y: 0, z: 0 });
		expect(state.forward).toEqual({ x: 0, y: 0, z: -1 });
	});

	it('ポインタが右にあると視線も右(forward.x > 0)を向く', () => {
		const right = listenerFromPointer({ x: 950, y: 400 }, viewport);
		const left = listenerFromPointer({ x: 50, y: 400 }, viewport);

		expect(right.forward.x).toBeGreaterThan(0);
		expect(left.forward.x).toBeLessThan(0);
		expect(right.position.x).toBeGreaterThan(left.position.x);
	});

	it('ポインタが上にあると視線も上(forward.y > 0)を向く', () => {
		expect(listenerFromPointer({ x: 500, y: 20 }, viewport).forward.y).toBeGreaterThan(0);
		expect(listenerFromPointer({ x: 500, y: 780 }, viewport).forward.y).toBeLessThan(0);
	});

	it('forward は単位ベクトルで、up と直交する既定の向きを保つ', () => {
		const { forward, up } = listenerFromPointer({ x: 800, y: 200 }, viewport);
		const length = Math.hypot(forward.x, forward.y, forward.z);

		expect(length).toBeCloseTo(1, 5);
		expect(up).toEqual({ x: 0, y: 1, z: 0 });
	});

	it('画面外のポインタ座標でも首の振り幅は制限される', () => {
		const extreme = listenerFromPointer({ x: 99999, y: -99999 }, viewport);
		const edge = listenerFromPointer({ x: 1000, y: 0 }, viewport);

		expect(extreme.forward.x).toBeCloseTo(edge.forward.x, 5);
		expect(extreme.forward.z).toBeLessThan(0); // 後ろを向いてしまわない
	});
});
