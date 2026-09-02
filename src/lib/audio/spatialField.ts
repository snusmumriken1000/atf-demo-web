/*
 * 空間オーディオの「音場」を決める純粋関数群(Web Audio API に一切依存しない)。
 *
 * 画面上の要素の位置を 3D の音の配置へ写像する計算だけをここに置く。音の高さや譜面は
 * chillScore.ts、実際の音づくり(ノードグラフ)は spatialAudioEngine.ts が担当する。
 * ブラウザ API を使わないので単体テストで挙動を固定できる。
 *
 * 座標系は Web Audio の既定に合わせる(右手系):
 *   x = 右が正 / y = 上が正 / z = 手前が正(奥がマイナス)
 * リスナーは原点付近に立ち、音源は画面の見た目どおり前方(z < 0)に並ぶ。
 */

export type Vector3 = { x: number; y: number; z: number };

/** 画面上の矩形(DOMRect のうち計算に使う 4 値だけ) */
export type Rect = { left: number; top: number; width: number; height: number };

/** ビューポートの大きさ */
export type Viewport = { width: number; height: number };

/** ポインタの画面座標(clientX / clientY) */
export type Pointer = { x: number; y: number };

/** リスナー(聴き手)の位置と向き */
export type ListenerState = {
	position: Vector3;
	/** 正面方向の単位ベクトル */
	forward: Vector3;
	/** 頭の上方向の単位ベクトル */
	up: Vector3;
};

/* ---- 音場の広さ(この 4 値で体験の「スケール感」が決まる) ---- */

/** 画面左端 / 右端を x = ∓この値に写す */
const FIELD_HALF_WIDTH = 3;
/** 画面上端 / 下端を y = ±この値に写す */
const FIELD_HALF_HEIGHT = 1.6;
/** 画面中央にある要素の奥行き(近い) */
const NEAR_DEPTH = 1.2;
/** 画面の上下端にある要素の奥行き(遠い) */
const FAR_DEPTH = 6;

/** ポインタで首を振れる最大角(ラジアン)。約 40 度。大きすぎると酔う */
const MAX_YAW = 0.7;
const MAX_PITCH = 0.26;
/** ポインタでリスナー自身がずれる量 */
const LISTENER_SHIFT_X = 1;
const LISTENER_SHIFT_Y = 0.4;

/** ポインタが音源に重なったときの音量の持ち上げ幅(1 + この値が最大) */
const PROXIMITY_BOOST = 0.8;
/** 持ち上げが効く距離(ビューポート対角に対する比) */
const PROXIMITY_RADIUS = 0.35;

export const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

/**
 * 要素の画面位置を音源の 3D 座標へ写す。
 *
 * 左右(x)は見た目のまま、上下(y)は画面の上を音の上に対応させる。
 * 奥行き(z)は「画面中央から縦に離れているほど遠い」とする。スクロールで
 * 画面中央に入ってきた作品が手前に近づいてくる動きになる。
 */
export function positionForRect(rect: Rect, viewport: Viewport): Vector3 {
	const width = Math.max(1, viewport.width);
	const height = Math.max(1, viewport.height);
	const centerX = rect.left + rect.width / 2;
	const centerY = rect.top + rect.height / 2;

	const normalizedX = clamp((centerX / width) * 2 - 1, -1, 1);
	const normalizedY = (centerY / height) * 2 - 1;
	const depth = NEAR_DEPTH + clamp(Math.abs(normalizedY), 0, 1) * (FAR_DEPTH - NEAR_DEPTH);

	return {
		x: normalizedX * FIELD_HALF_WIDTH,
		y: -clamp(normalizedY, -1, 1) * FIELD_HALF_HEIGHT,
		z: -depth
	};
}

/**
 * ポインタが要素に近いほど大きくなる音量倍率(1 〜 1 + PROXIMITY_BOOST)。
 *
 * hover / focus のイベントを個別に配線しなくても、視線(ポインタ)を向けた
 * 作品の音が持ち上がる。ポインタがない(タッチ・キーボード操作)ときは 1。
 */
export function proximityLevel(rect: Rect, pointer: Pointer | null, viewport: Viewport): number {
	if (!pointer) return 1;

	const width = Math.max(1, viewport.width);
	const height = Math.max(1, viewport.height);
	const deltaX = (pointer.x - (rect.left + rect.width / 2)) / width;
	const deltaY = (pointer.y - (rect.top + rect.height / 2)) / height;
	const distance = Math.hypot(deltaX, deltaY);

	return 1 + clamp(1 - distance / PROXIMITY_RADIUS, 0, 1) * PROXIMITY_BOOST;
}

/**
 * 音場をゆっくり回すための位相(-1 〜 1)。period 秒で 1 周する。
 *
 * 操作しなくても和音の床が静かに漂い、空間が生きているように感じられる。
 * ポインタ操作(listenerFromPointer)とは独立に効く。
 */
export function driftPhase(seconds: number, period: number): number {
	if (period <= 0) return 0;
	return Math.sin((seconds / period) * Math.PI * 2);
}

/**
 * ポインタ位置からリスナーの位置と向きを決める。
 *
 * pointer が null(ポインタなし / reduced-motion)のときは正面固定の
 * 既定状態を返す。音像は動かないが、音源の左右・奥行きの定位は保たれる。
 */
export function listenerFromPointer(pointer: Pointer | null, viewport: Viewport): ListenerState {
	const up = { x: 0, y: 1, z: 0 };
	if (!pointer) {
		return { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 }, up };
	}

	const width = Math.max(1, viewport.width);
	const height = Math.max(1, viewport.height);
	const normalizedX = clamp((pointer.x / width) * 2 - 1, -1, 1);
	const normalizedY = clamp((pointer.y / height) * 2 - 1, -1, 1);

	const yaw = normalizedX * MAX_YAW;
	const pitch = -normalizedY * MAX_PITCH;

	return {
		position: {
			x: normalizedX * LISTENER_SHIFT_X,
			y: -normalizedY * LISTENER_SHIFT_Y,
			z: 0
		},
		forward: {
			x: Math.sin(yaw) * Math.cos(pitch),
			y: Math.sin(pitch),
			z: -Math.cos(yaw) * Math.cos(pitch)
		},
		up
	};
}
