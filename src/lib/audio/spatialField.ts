/*
 * 空間オーディオの「音場」を決める純粋関数群(Web Audio API に一切依存しない)。
 *
 * 画面上の見た目(要素の位置・作品の色相)を 3D の音の配置へ写像する計算だけを
 * ここに置き、実際の音づくり(ノードグラフ)は spatialAudioEngine.ts が担当する。
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

/** ポインタで首を振れる最大角(ラジアン)。大きすぎると酔うので控えめにする */
const MAX_YAW = 0.45;
const MAX_PITCH = 0.22;
/** ポインタでリスナー自身がずれる量 */
const LISTENER_SHIFT_X = 0.6;
const LISTENER_SHIFT_Y = 0.3;

/** ポインタが音源に重なったときの音量の持ち上げ幅(1 + この値が最大) */
const PROXIMITY_BOOST = 0.8;
/** 持ち上げが効く距離(ビューポート対角に対する比) */
const PROXIMITY_RADIUS = 0.35;

/** 5 音音階(ペンタトニック)の半音。どの 2 音を重ねても濁らない */
const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9];

export const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

/**
 * 作品の色相(0〜360)を音の高さに写す。
 *
 * 色相をそのまま連続的な周波数にすると隣り合う作品が半音でぶつかるため、
 * ペンタトニックの音度に量子化してから周波数へ戻す。これで何音が同時に
 * 鳴っても協和する。色が近い作品は音も近い、という対応は保たれる。
 *
 * @param hue 色相(範囲外・負の値は 0〜360 に丸め込む)
 * @param baseHz 最低音(hue = 0 のときの周波数)
 * @param octaveRange 使うオクターブ数
 */
export function hueToFrequency(hue: number, baseHz: number, octaveRange: number): number {
	const normalized = ((hue % 360) + 360) % 360;
	const degreeCount = Math.max(1, Math.round(PENTATONIC_SEMITONES.length * octaveRange));
	const degree = Math.min(degreeCount - 1, Math.floor((normalized / 360) * degreeCount));
	const octave = Math.floor(degree / PENTATONIC_SEMITONES.length);
	const semitone = octave * 12 + PENTATONIC_SEMITONES[degree % PENTATONIC_SEMITONES.length];
	return baseHz * Math.pow(2, semitone / 12);
}

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
