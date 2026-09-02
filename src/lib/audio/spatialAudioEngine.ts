/*
 * 空間オーディオのエンジン(Web Audio API のノードグラフ管理)。
 *
 * 【音声ファイルを一切持たない方針】
 * 外部リソースを読み込まない制約に対し、音声ファイルを同梱するのではなく
 * オシレータとノイズから音そのものを生成する。リポジトリに増えるのはこのコードだけで、
 * バイナリ資産は 0 byte。残響(ConvolverNode)のインパルス応答もコードで作る。
 *
 * 【グラフの形】
 *   voice(osc / noise) → filter → toneGain(LFO で揺らぐ) → levelGain(アプリが制御)
 *     → panner(HRTF) →┬→ master → destination
 *                      └→ reverbSend → convolver → master
 *
 * 定位は PannerNode の panningModel = 'HRTF' に任せる。ヘッドホンで聴くと
 * 前後・左右・上下が知覚できる(スピーカーでは左右の広がりに留まる)。
 *
 * 【AudioContext は外から渡す】
 * テストで差し替えられるよう、コンテキストの生成は createAudioContext() に分け、
 * エンジン自身は渡されたコンテキストだけを触る。
 */

import type { ListenerState, Vector3 } from './spatialField';

/** 音源の種類。種類ごとに声(voice)の作り方とフィルタが変わる */
export type SourceKind = 'drone' | 'tone' | 'air';

export type SpatialSourceSpec = {
	/** 音源の識別子(showcase の data-audio-source と対応させる) */
	id: string;
	kind: SourceKind;
	/** 基準となる周波数(Hz) */
	frequency: number;
};

/** フェードイン / アウトにかける秒数(音の出入りを滑らかにする) */
export const FADE_SECONDS = 1.2;
/** AudioParam を滑らかに追従させるときの時定数(秒) */
const POSITION_SMOOTHING = 0.12;
const LEVEL_SMOOTHING = 0.08;
/** 無音とみなす下限。指数ランプは 0 を扱えないため使う */
const SILENCE = 0.0001;

/** 種類ごとの基準音量。合計しても歪まないよう控えめに置く */
const KIND_GAIN: Record<SourceKind, number> = {
	drone: 0.32,
	tone: 0.22,
	air: 0.1
};

/** 揺らぎ(LFO)の速さ。音源ごとに少しずつずらして周期の一致を避ける */
const LFO_BASE_HZ = 0.05;
const LFO_STEP_HZ = 0.017;
/** 揺らぎの深さ(基準音量に対する比) */
const LFO_DEPTH_RATIO = 0.35;

/** 要素が見つからない音源(環境音)の既定位置 */
const DEFAULT_POSITION: Vector3 = { x: 0, y: 1.2, z: -3 };

type SourceNodes = {
	spec: SpatialSourceSpec;
	voices: (OscillatorNode | AudioBufferSourceNode)[];
	lfo: OscillatorNode;
	levelGain: GainNode;
	panner: PannerNode;
};

/**
 * このブラウザが空間オーディオを扱えるか。
 * 使えない環境ではトグル自体を出さない(段階的強化)。
 */
export function isSpatialAudioSupported(): boolean {
	if (typeof window === 'undefined') return false;
	return typeof resolveAudioContextConstructor() === 'function';
}

function resolveAudioContextConstructor(): typeof AudioContext | undefined {
	if (typeof window === 'undefined') return undefined;
	// webkitAudioContext は古い Safari 向けのフォールバック
	const legacy = (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	return typeof window.AudioContext === 'function' ? window.AudioContext : legacy;
}

/** AudioContext を生成する。非対応環境では null を返す */
export function createAudioContext(): AudioContext | null {
	const Constructor = resolveAudioContextConstructor();
	if (!Constructor) return null;
	return new Constructor();
}

/**
 * 残響用のインパルス応答をコードで生成する。
 * ノイズを指数関数で減衰させただけの単純なものだが、音源に「部屋の広さ」が付き
 * 前後の距離感が掴みやすくなる。
 */
function createImpulseResponse(context: AudioContext, seconds: number, decay: number): AudioBuffer {
	const length = Math.max(1, Math.floor(context.sampleRate * seconds));
	const buffer = context.createBuffer(2, length, context.sampleRate);

	for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
		const data = buffer.getChannelData(channel);
		for (let index = 0; index < length; index += 1) {
			// 左右で違うノイズにすると残響が広がって聞こえる
			data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, decay);
		}
	}
	return buffer;
}

/** ループ再生用のホワイトノイズ(空気感の音源) */
function createNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
	const length = Math.max(1, Math.floor(context.sampleRate * seconds));
	const buffer = context.createBuffer(1, length, context.sampleRate);
	const data = buffer.getChannelData(0);
	for (let index = 0; index < length; index += 1) {
		data[index] = Math.random() * 2 - 1;
	}
	return buffer;
}

/** AudioParam を滑らかに動かす。setTargetAtTime 非対応なら即値で代用する */
function rampParam(param: AudioParam | undefined, value: number, now: number, smoothing: number) {
	if (!param) return;
	if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(value, now, smoothing);
	else param.value = value;
}

/**
 * PannerNode / AudioListener の位置・向きを設定する。
 * 新しい AudioParam 方式を優先し、非対応(古い Safari 等)は
 * 非推奨の setPosition / setOrientation にフォールバックする。
 */
function applyVector(
	target: { [key: string]: unknown },
	prefix: 'position' | 'forward' | 'orientation' | 'up',
	vector: Vector3,
	now: number,
	legacy?: (x: number, y: number, z: number) => void
) {
	const axisX = target[`${prefix}X`] as AudioParam | undefined;
	if (axisX) {
		rampParam(axisX, vector.x, now, POSITION_SMOOTHING);
		rampParam(target[`${prefix}Y`] as AudioParam | undefined, vector.y, now, POSITION_SMOOTHING);
		rampParam(target[`${prefix}Z`] as AudioParam | undefined, vector.z, now, POSITION_SMOOTHING);
		return;
	}
	legacy?.(vector.x, vector.y, vector.z);
}

export class SpatialAudioEngine {
	readonly context: AudioContext;

	#master: GainNode;
	#reverbSend: GainNode;
	#noiseBuffer: AudioBuffer | null = null;
	#sources = new Map<string, SourceNodes>();
	#volume: number;
	#disposed = false;

	constructor(context: AudioContext, volume: number) {
		this.context = context;
		this.#volume = volume;

		this.#master = context.createGain();
		this.#master.gain.value = SILENCE;
		this.#master.connect(context.destination);

		const convolver = context.createConvolver();
		convolver.buffer = createImpulseResponse(context, 2.4, 2.6);
		convolver.connect(this.#master);

		this.#reverbSend = context.createGain();
		this.#reverbSend.gain.value = 0.3;
		this.#reverbSend.connect(convolver);
	}

	/** 登録済みの音源 id 一覧(テスト・デバッグ用) */
	get sourceIds(): string[] {
		return [...this.#sources.keys()];
	}

	/** 音源を 1 つ足して鳴らし始める(音量は master が 0 のため、まだ聞こえない) */
	addSource(spec: SpatialSourceSpec): void {
		if (this.#disposed || this.#sources.has(spec.id)) return;

		const context = this.context;
		const now = context.currentTime;
		const baseGain = KIND_GAIN[spec.kind];

		const panner = context.createPanner();
		panner.panningModel = 'HRTF';
		panner.distanceModel = 'inverse';
		panner.refDistance = 1;
		panner.maxDistance = 30;
		panner.rolloffFactor = 1.1;
		panner.connect(this.#master);
		panner.connect(this.#reverbSend);

		// アプリ側(ポインタとの距離)で動かす音量
		const levelGain = context.createGain();
		levelGain.gain.value = 1;
		levelGain.connect(panner);

		// LFO でゆっくり揺れる音量
		const toneGain = context.createGain();
		toneGain.gain.value = baseGain;
		toneGain.connect(levelGain);

		const filter = context.createBiquadFilter();
		filter.connect(toneGain);

		const voices: (OscillatorNode | AudioBufferSourceNode)[] = [];

		if (spec.kind === 'air') {
			// 空気感: ノイズを帯域通過させた薄い層
			filter.type = 'bandpass';
			filter.frequency.value = spec.frequency;
			filter.Q.value = 0.8;

			this.#noiseBuffer ??= createNoiseBuffer(context, 2);
			const noise = context.createBufferSource();
			noise.buffer = this.#noiseBuffer;
			noise.loop = true;
			noise.connect(filter);
			voices.push(noise);
		} else {
			// ドローン / トーン: 基音ともう 1 音をわずかにずらして厚みを出す
			filter.type = 'lowpass';
			filter.frequency.value = spec.frequency * (spec.kind === 'drone' ? 3 : 3.5);
			filter.Q.value = 0.6;

			const partials = spec.kind === 'drone' ? [1, 1.005] : [1, 2.002];
			for (const ratio of partials) {
				const oscillator = context.createOscillator();
				oscillator.type = 'sine';
				oscillator.frequency.value = spec.frequency * ratio;
				const partialGain = context.createGain();
				// 上の倍音は控えめに重ねる
				partialGain.gain.value = ratio === 1 ? 1 : 0.35;
				oscillator.connect(partialGain);
				partialGain.connect(filter);
				voices.push(oscillator);
			}
		}

		// 音量の揺らぎ。周期は音源ごとにずらして重なりを避ける
		const lfo = context.createOscillator();
		lfo.type = 'sine';
		lfo.frequency.value = LFO_BASE_HZ + this.#sources.size * LFO_STEP_HZ;
		const lfoDepth = context.createGain();
		lfoDepth.gain.value = baseGain * LFO_DEPTH_RATIO;
		lfo.connect(lfoDepth);
		lfoDepth.connect(toneGain.gain);

		for (const voice of voices) voice.start(now);
		lfo.start(now);

		this.#sources.set(spec.id, { spec, voices, lfo, levelGain, panner });
		this.setSourcePosition(spec.id, DEFAULT_POSITION);
	}

	/** 音源の 3D 位置を更新する */
	setSourcePosition(id: string, position: Vector3): void {
		const source = this.#sources.get(id);
		if (!source) return;
		const panner = source.panner as unknown as { [key: string]: unknown };
		applyVector(
			panner,
			'position',
			position,
			this.context.currentTime,
			typeof source.panner.setPosition === 'function'
				? source.panner.setPosition.bind(source.panner)
				: undefined
		);
	}

	/** 音源の音量倍率を更新する(ポインタとの距離で持ち上げる) */
	setSourceLevel(id: string, level: number): void {
		const source = this.#sources.get(id);
		if (!source) return;
		rampParam(source.levelGain.gain, level, this.context.currentTime, LEVEL_SMOOTHING);
	}

	/** リスナー(聴き手)の位置と向きを更新する */
	setListener(state: ListenerState): void {
		if (this.#disposed) return;
		const listener = this.context.listener as unknown as {
			[key: string]: unknown;
			setPosition?: (x: number, y: number, z: number) => void;
			setOrientation?: (
				x: number,
				y: number,
				z: number,
				upX: number,
				upY: number,
				upZ: number
			) => void;
		};
		const now = this.context.currentTime;

		applyVector(listener, 'position', state.position, now, listener.setPosition?.bind(listener));
		applyVector(listener, 'forward', state.forward, now, () =>
			listener.setOrientation?.(
				state.forward.x,
				state.forward.y,
				state.forward.z,
				state.up.x,
				state.up.y,
				state.up.z
			)
		);
		applyVector(listener, 'up', state.up, now);
	}

	/** 全体音量を上げて聞こえる状態にする */
	async fadeIn(): Promise<void> {
		if (this.#disposed) return;
		if (this.context.state === 'suspended') await this.context.resume();
		const now = this.context.currentTime;
		const gain = this.#master.gain;
		gain.cancelScheduledValues(now);
		gain.setValueAtTime(Math.max(SILENCE, gain.value), now);
		gain.linearRampToValueAtTime(this.#volume, now + FADE_SECONDS);
	}

	/** 全体音量を絞る。フェードが終わるまで待ってから resolve する */
	async fadeOut(): Promise<void> {
		if (this.#disposed) return;
		const now = this.context.currentTime;
		const gain = this.#master.gain;
		gain.cancelScheduledValues(now);
		gain.setValueAtTime(Math.max(SILENCE, gain.value), now);
		gain.linearRampToValueAtTime(SILENCE, now + FADE_SECONDS);
	}

	/** タブが隠れている間など、音を止めて CPU を使わないようにする */
	async suspend(): Promise<void> {
		if (this.#disposed || this.context.state !== 'running') return;
		await this.context.suspend();
	}

	/** suspend() から復帰する */
	async resume(): Promise<void> {
		if (this.#disposed || this.context.state === 'running') return;
		await this.context.resume();
	}

	/** 全ノードを停止・破棄し、AudioContext を閉じる */
	async dispose(): Promise<void> {
		if (this.#disposed) return;
		this.#disposed = true;

		for (const source of this.#sources.values()) {
			for (const voice of source.voices) {
				try {
					voice.stop();
				} catch {
					// 既に停止済みなら無視してよい
				}
				voice.disconnect();
			}
			try {
				source.lfo.stop();
			} catch {
				// 同上
			}
			source.lfo.disconnect();
			source.levelGain.disconnect();
			source.panner.disconnect();
		}
		this.#sources.clear();
		this.#master.disconnect();
		this.#reverbSend.disconnect();

		if (this.context.state !== 'closed') await this.context.close();
	}
}
