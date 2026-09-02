/*
 * 空間オーディオのエンジン(Web Audio API のノードグラフ管理)。
 *
 * 【音声ファイルを一切持たない方針】
 * 外部リソースを読み込まない制約に対し、音声ファイルを同梱するのではなく
 * オシレータとノイズから音そのものを生成する。リポジトリに増えるのはこのコードだけで、
 * バイナリ資産は 0 byte。残響(ConvolverNode)のインパルス応答もコードで作る。
 *
 * 【スロットという考え方】
 * 音源を「スロット(= 空間上の位置)」として先に用意し、譜面(chillScore.ts)が
 * そこへ音符を投げ込む。スロットは DOM 要素に紐づけて動かせるので、
 * 「メロディは作品タイルの位置から鳴り、スクロールすると音像も動く」が成り立つ。
 *
 *   voice(osc / noise) → env → slot.input → panner(HRTF) →┬→ master → destination
 *                                                          └→ reverbSend → convolver → master
 *
 * 定位は PannerNode の panningModel = 'HRTF' に任せる。ヘッドホンで聴くと
 * 前後・左右・上下が知覚できる(スピーカーでは左右の広がりに留まる)。
 *
 * 【AudioContext は外から渡す】
 * テストで差し替えられるよう、コンテキストの生成は createAudioContext() に分け、
 * エンジン自身は渡されたコンテキストだけを触る。
 */

import type { Note, NoteKind } from './chillScore';
import type { ListenerState, Vector3 } from './spatialField';

/** フェードイン / アウトにかける秒数(音の出入りを滑らかにする) */
export const FADE_SECONDS = 1.2;
/** AudioParam を滑らかに追従させるときの時定数(秒) */
const POSITION_SMOOTHING = 0.12;
const LEVEL_SMOOTHING = 0.08;
/** 無音とみなす下限。指数ランプは 0 を扱えないため使う */
const SILENCE = 0.0001;

/*
 * 音色ごとの音量。打点だけが飛び出して隙間が無音になると「チル」に聞こえないので、
 * パッド(和音の床)を厚めに、打楽器を控えめに置いてバランスを取っている。
 */
const KIND_GAIN: Record<NoteKind, number> = {
	kick: 0.7,
	snare: 0.28,
	hat: 0.13,
	bass: 0.55,
	pad: 0.34,
	key: 0.32
};

/** 要素に紐づかないスロットの既定位置 */
const DEFAULT_POSITION: Vector3 = { x: 0, y: 0, z: -2 };

type Slot = {
	id: string;
	input: GainNode;
	panner: PannerNode;
};

type ActiveVoice = {
	nodes: (OscillatorNode | AudioBufferSourceNode)[];
	gain: GainNode;
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

/** ループ再生用のホワイトノイズ(ハイハット・スネア・空気感の材料) */
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
	prefix: 'position' | 'forward' | 'up',
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
	#slots = new Map<string, Slot>();
	#active = new Set<ActiveVoice>();
	#volume: number;
	#disposed = false;

	constructor(context: AudioContext, volume: number) {
		this.context = context;
		this.#volume = volume;

		this.#master = context.createGain();
		this.#master.gain.value = SILENCE;
		this.#master.connect(context.destination);

		const convolver = context.createConvolver();
		convolver.buffer = createImpulseResponse(context, 2.6, 2.4);
		convolver.connect(this.#master);

		this.#reverbSend = context.createGain();
		// チルな音像にするため残響は深めに。ただし輪郭が消えない程度で止める
		this.#reverbSend.gain.value = 0.34;
		this.#reverbSend.connect(convolver);
	}

	/** 現在の再生時刻(秒)。スケジューラが先読みの基準に使う */
	get currentTime(): number {
		return this.context.currentTime;
	}

	/** 登録済みのスロット id 一覧 */
	get slotIds(): string[] {
		return [...this.#slots.keys()];
	}

	/** 音を鳴らす場所(スロット)を用意する。位置は後から更新できる */
	addSlot(id: string): void {
		if (this.#disposed || this.#slots.has(id)) return;
		const context = this.context;

		const panner = context.createPanner();
		panner.panningModel = 'HRTF';
		panner.distanceModel = 'inverse';
		// 距離による減衰は緩めにする。強すぎると左右に広げたパッドが消えてしまう
		panner.refDistance = 1.5;
		panner.maxDistance = 30;
		panner.rolloffFactor = 0.7;
		panner.connect(this.#master);
		panner.connect(this.#reverbSend);

		const input = context.createGain();
		input.gain.value = 1;
		input.connect(panner);

		this.#slots.set(id, { id, input, panner });
		this.setSlotPosition(id, DEFAULT_POSITION);
	}

	/** スロットの 3D 位置を更新する */
	setSlotPosition(id: string, position: Vector3): void {
		const slot = this.#slots.get(id);
		if (!slot) return;
		applyVector(
			slot.panner as unknown as { [key: string]: unknown },
			'position',
			position,
			this.context.currentTime,
			typeof slot.panner.setPosition === 'function'
				? slot.panner.setPosition.bind(slot.panner)
				: undefined
		);
	}

	/** スロットの音量倍率を更新する(ポインタとの距離で持ち上げる) */
	setSlotLevel(id: string, level: number): void {
		const slot = this.#slots.get(id);
		if (!slot) return;
		rampParam(slot.input.gain, level, this.context.currentTime, LEVEL_SMOOTHING);
	}

	/**
	 * 常時鳴らす環境音(レコードのノイズのような薄い層)を始める。
	 * ビートの隙間を埋めて、曲全体をひとつの空間に置いて聞かせる役割。
	 */
	startAmbience(slotId: string, frequency: number, level = 0.13): void {
		const slot = this.#slots.get(slotId);
		if (this.#disposed || !slot) return;
		const context = this.context;

		this.#noiseBuffer ??= createNoiseBuffer(context, 2);
		const noise = context.createBufferSource();
		noise.buffer = this.#noiseBuffer;
		noise.loop = true;

		const filter = context.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = frequency;
		filter.Q.value = 0.7;

		const gain = context.createGain();
		gain.gain.value = level;

		noise.connect(filter);
		filter.connect(gain);
		gain.connect(slot.input);
		noise.start(context.currentTime);

		this.#active.add({ nodes: [noise], gain });
	}

	/**
	 * 音符を 1 つ鳴らす。when は AudioContext の絶対時刻(秒)。
	 * 鳴り終わったノードは自動で切り離す。
	 */
	triggerNote(note: Note, when: number): void {
		const slot = this.#slots.get(note.slot);
		if (this.#disposed || !slot) return;

		const context = this.context;
		const peak = KIND_GAIN[note.kind] * note.level;
		const gain = context.createGain();
		gain.gain.setValueAtTime(SILENCE, when);
		gain.connect(slot.input);

		const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
		/** 音色ごとの終端。ここまで鳴らしてから停止する */
		let stopAt = when + note.duration;

		const noise = (): AudioBufferSourceNode => {
			this.#noiseBuffer ??= createNoiseBuffer(context, 2);
			const source = context.createBufferSource();
			source.buffer = this.#noiseBuffer;
			source.loop = true;
			return source;
		};

		switch (note.kind) {
			case 'kick': {
				// 低い正弦波のピッチを一気に落とすと胴のある低音になる
				const oscillator = context.createOscillator();
				oscillator.type = 'sine';
				oscillator.frequency.setValueAtTime(note.frequency, when);
				oscillator.frequency.exponentialRampToValueAtTime(45, when + 0.09);
				oscillator.connect(gain);
				nodes.push(oscillator);

				gain.gain.linearRampToValueAtTime(peak, when + 0.006);
				gain.gain.exponentialRampToValueAtTime(SILENCE, when + note.duration);
				break;
			}
			case 'snare': {
				// ノイズを帯域で絞ってブラシのような当たりにする
				const source = noise();
				const filter = context.createBiquadFilter();
				filter.type = 'bandpass';
				filter.frequency.value = note.frequency;
				filter.Q.value = 1.1;
				source.connect(filter);
				filter.connect(gain);
				nodes.push(source);

				gain.gain.linearRampToValueAtTime(peak, when + 0.004);
				gain.gain.exponentialRampToValueAtTime(SILENCE, when + note.duration);
				break;
			}
			case 'hat': {
				const source = noise();
				const filter = context.createBiquadFilter();
				filter.type = 'highpass';
				filter.frequency.value = note.frequency;
				source.connect(filter);
				filter.connect(gain);
				nodes.push(source);

				gain.gain.linearRampToValueAtTime(peak, when + 0.002);
				gain.gain.exponentialRampToValueAtTime(SILENCE, when + note.duration);
				break;
			}
			case 'bass': {
				// 基音に少しだけ三角波を混ぜて芯を出す
				const filter = context.createBiquadFilter();
				filter.type = 'lowpass';
				filter.frequency.value = 320;
				filter.Q.value = 0.7;
				filter.connect(gain);

				for (const [type, ratio, mix] of [
					['sine', 1, 1],
					['triangle', 2, 0.18]
				] as const) {
					const oscillator = context.createOscillator();
					oscillator.type = type;
					oscillator.frequency.value = note.frequency * ratio;
					const mixGain = context.createGain();
					mixGain.gain.value = mix;
					oscillator.connect(mixGain);
					mixGain.connect(filter);
					nodes.push(oscillator);
				}

				gain.gain.linearRampToValueAtTime(peak, when + 0.03);
				gain.gain.exponentialRampToValueAtTime(SILENCE, when + note.duration);
				break;
			}
			case 'pad': {
				// ゆっくり立ち上がってゆっくり消える。和音の土台
				const filter = context.createBiquadFilter();
				filter.type = 'lowpass';
				filter.frequency.value = 1100;
				filter.Q.value = 0.5;
				filter.connect(gain);

				for (const detune of [-6, 6]) {
					const oscillator = context.createOscillator();
					oscillator.type = 'sine';
					oscillator.frequency.value = note.frequency;
					// わずかにずらした 2 声のうねりが厚みになる
					if (oscillator.detune) oscillator.detune.value = detune;
					oscillator.connect(filter);
					nodes.push(oscillator);
				}

				// 立ち上がりを長く、保持も長く取る。次の小節の和音と重なって途切れない
				const attack = Math.min(1.2, note.duration * 0.35);
				gain.gain.linearRampToValueAtTime(peak, when + attack);
				gain.gain.setValueAtTime(peak, when + note.duration * 0.75);
				gain.gain.exponentialRampToValueAtTime(SILENCE, when + note.duration);
				break;
			}
			case 'key': {
				// エレピ風。倍音を薄く足した減衰音
				const filter = context.createBiquadFilter();
				filter.type = 'lowpass';
				filter.frequency.value = 2400;
				filter.Q.value = 0.6;
				filter.connect(gain);

				for (const [type, ratio, mix] of [
					['triangle', 1, 1],
					['sine', 2, 0.3],
					['sine', 3.01, 0.08]
				] as const) {
					const oscillator = context.createOscillator();
					oscillator.type = type;
					oscillator.frequency.value = note.frequency * ratio;
					const mixGain = context.createGain();
					mixGain.gain.value = mix;
					oscillator.connect(mixGain);
					mixGain.connect(filter);
					nodes.push(oscillator);
				}

				// 余韻を長めに取ると空間の広さが出る
				stopAt = when + note.duration * 1.8;
				gain.gain.linearRampToValueAtTime(peak, when + 0.008);
				gain.gain.exponentialRampToValueAtTime(SILENCE, stopAt);
				break;
			}
		}

		const voice: ActiveVoice = { nodes, gain };
		this.#active.add(voice);

		for (const node of nodes) {
			node.start(when);
			node.stop(stopAt);
		}
		// 最後のノードが鳴り終わったら切り離す
		const last = nodes.at(-1);
		if (last) {
			last.onended = () => {
				this.#releaseVoice(voice);
			};
		}
	}

	#releaseVoice(voice: ActiveVoice) {
		if (!this.#active.delete(voice)) return;
		for (const node of voice.nodes) node.disconnect();
		voice.gain.disconnect();
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

	/** 全体音量を絞る */
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

		for (const voice of [...this.#active]) {
			for (const node of voice.nodes) {
				try {
					node.stop();
				} catch {
					// 既に停止済みなら無視してよい
				}
			}
			this.#releaseVoice(voice);
		}
		for (const slot of this.#slots.values()) {
			slot.input.disconnect();
			slot.panner.disconnect();
		}
		this.#slots.clear();
		this.#master.disconnect();
		this.#reverbSend.disconnect();

		if (this.context.state !== 'closed') await this.context.close();
	}
}
