/*
 * 面 1 で鳴らす「チル」な曲の譜面を組み立てる純粋関数群(Web Audio API に依存しない)。
 *
 * ドローンを流しっぱなしにするのではなく、テンポとコード進行を持った 4 小節ループを
 * 生成する。どの音をどのスロット(= 空間上の位置)から鳴らすかもここで決めるので、
 * 「リズムは正面に据わり、メロディは作品タイルの位置から鳴る」という構成になる。
 *
 * 揺らぎには乱数を使うが、小節番号から決まるシード付き擬似乱数なので、
 * 何度再生しても同じ小節は同じ譜面になる(テストで固定できる)。
 */

/** 音を鳴らす場所。実際の 3D 座標は SpatialAudioScene が割り当てる */
export type SlotId = string;

/** 固定位置のスロット(DOM 要素に紐づかない) */
export const RHYTHM_SLOT = 'rhythm';
export const PERC_SLOT = 'perc';
export const PAD_LEFT_SLOT = 'pad-left';
export const PAD_RIGHT_SLOT = 'pad-right';
export const AIR_SLOT = 'air';
/** ヒーロー(見出し)の要素に紐づくスロット */
export const HERO_SLOT = 'hero';

/** 音色の種類。エンジン側がこの種類ごとに音を作る */
export type NoteKind = 'kick' | 'snare' | 'hat' | 'bass' | 'pad' | 'key';

/** 鳴らす音 1 つ */
export type Note = {
	slot: SlotId;
	kind: NoteKind;
	/** 周波数(Hz)。打楽器では音色の基準値として使う */
	frequency: number;
	/** 音楽の開始からの秒数 */
	time: number;
	/** 長さ(秒) */
	duration: number;
	/** 音量倍率(0〜1 目安) */
	level: number;
};

export type Chord = {
	name: string;
	/** 主音からの半音。パッドとメロディが使える音 */
	tones: number[];
	/** ベースの音(主音から下向きの半音を含む) */
	bass: number;
};

/**
 * コード進行(1 小節 1 コードの 4 小節ループ)。
 * ii - V - I - vi の循環に 9th / 13th を足した、いわゆるチルな響き。
 */
export const PROGRESSION: Chord[] = [
	{ name: 'Dm9', tones: [2, 5, 9, 12, 16], bass: -10 },
	{ name: 'G13', tones: [2, 7, 11, 14, 17], bass: -5 },
	{ name: 'Cmaj9', tones: [0, 4, 7, 11, 14], bass: -12 },
	{ name: 'Am9', tones: [0, 4, 9, 12, 16], bass: -15 }
];

/** 1 小節の拍数(4/4) */
export const BEATS_PER_BAR = 4;
/** 16 分音符 1 つ分の拍数 */
const STEP = 0.25;
/**
 * スイングの比率。0.5 = 均等、0.6 前後で跳ねる。
 * 裏拍の 8 分音符をこの位置(拍の何割か)へずらす。
 */
const SWING = 0.58;

/** 16 分グリッド上のリズムパターン(数字は 16 分音符の位置) */
const KICK_STEPS = [0, 6, 10];
const SNARE_STEPS = [4, 12];
const BASS_STEPS = [0, 10];
/** メロディが置かれうる位置。この中からシードで 2〜3 個選ぶ */
const KEY_CANDIDATE_STEPS = [2, 4, 6, 10, 12, 14];

export type ChillOptions = {
	/** テンポ(1 分あたりの拍数) */
	bpm: number;
	/** 主音の周波数(Hz)。content.ts の audio.baseHz */
	baseHz: number;
	/** メロディが広がる音域(オクターブ数) */
	octaveRange: number;
	/** 作品タイルの色相(表示順) */
	tileHues: number[];
	/** 作品タイルのスロット id(tileHues と同じ並び) */
	tileSlots: SlotId[];
};

/** 小節番号から使うコードを返す(4 小節で 1 周) */
export function chordForBar(bar: number): Chord {
	const index = ((bar % PROGRESSION.length) + PROGRESSION.length) % PROGRESSION.length;
	return PROGRESSION[index];
}

/** 主音からの半音を周波数に直す */
export function semitoneToHz(baseHz: number, semitone: number): number {
	return baseHz * Math.pow(2, semitone / 12);
}

/** 小節番号から決まる擬似乱数(mulberry32)。同じ小節は必ず同じ並びになる */
function seededRandom(seed: number): () => number {
	let state = (seed * 1831565813 + 0x6d2b79f5) >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * 作品の色相に最も近いコード構成音を選ぶ。
 *
 * 色相をそのまま音程にすると和声から外れてしまうため、hue から求めた「理想の高さ」に
 * 一番近い構成音へ寄せる。色が違えば音も違う、という対応は保ちつつ、いつ鳴っても
 * コードに溶ける。
 */
export function tileNote(hue: number, chord: Chord, baseHz: number, octaveRange: number): number {
	const normalized = ((hue % 360) + 360) % 360;
	// メロディはコードより 1 オクターブ上を基準にする
	const target = 12 + (normalized / 360) * 12 * octaveRange;
	const candidates = chord.tones.flatMap((tone) => [tone, tone + 12]);
	const nearest = candidates.reduce((best, tone) =>
		Math.abs(tone - target) < Math.abs(best - target) ? tone : best
	);
	return semitoneToHz(baseHz, nearest);
}

/** 8 分音符の裏拍にスイングをかける */
function swung(step: number): number {
	const beat = Math.floor(step / 4);
	const withinBeat = (step % 4) * STEP;
	if (withinBeat === 0.5) return beat + SWING;
	return beat + withinBeat;
}

/**
 * 1 小節分の譜面を組み立てる。時間は小節先頭からの拍数で返す。
 * 同じ bar なら常に同じ結果になる。
 */
export function barNotes(
	bar: number,
	options: ChillOptions
): (Omit<Note, 'time'> & {
	beat: number;
})[] {
	const { baseHz, tileHues, tileSlots, octaveRange } = options;
	const chord = chordForBar(bar);
	const random = seededRandom(bar);
	const notes: (Omit<Note, 'time'> & { beat: number })[] = [];

	// --- リズム(正面に据える) ---
	for (const step of KICK_STEPS) {
		notes.push({
			slot: RHYTHM_SLOT,
			kind: 'kick',
			frequency: 140,
			beat: swung(step),
			duration: 0.4,
			level: step === 0 ? 1 : 0.75
		});
	}
	for (const step of SNARE_STEPS) {
		notes.push({
			slot: RHYTHM_SLOT,
			kind: 'snare',
			frequency: 1600,
			beat: swung(step),
			duration: 0.2,
			level: 0.7
		});
	}
	// ハイハットは 8 分。裏拍を弱くしてスイングさせる
	for (let step = 0; step < 16; step += 2) {
		const offbeat = step % 4 !== 0;
		notes.push({
			slot: PERC_SLOT,
			kind: 'hat',
			frequency: 9000,
			beat: swung(step),
			duration: 0.06,
			// わずかに強弱を散らすと機械的でなくなる
			level: (offbeat ? 0.3 : 0.5) * (0.85 + random() * 0.3)
		});
	}

	// --- ベース(リズムと同じ位置。低い音は定位が曖昧なので正面で良い) ---
	for (const [index, step] of BASS_STEPS.entries()) {
		notes.push({
			slot: RHYTHM_SLOT,
			kind: 'bass',
			frequency: semitoneToHz(baseHz, chord.bass + (index === 0 ? 0 : 12)),
			beat: swung(step),
			duration: index === 0 ? 1.6 : 0.7,
			level: index === 0 ? 0.9 : 0.6
		});
	}

	// --- パッド(左右に広げて音場の奥行きをつくる) ---
	// 小節の長さより少し長く鳴らし、次のコードと重ねて切れ目をなくす
	const padDuration = (BEATS_PER_BAR + 0.8) * (60 / options.bpm);
	const padTones = chord.tones.slice(0, 4);
	for (const [index, tone] of padTones.entries()) {
		notes.push({
			slot: index % 2 === 0 ? PAD_LEFT_SLOT : PAD_RIGHT_SLOT,
			kind: 'pad',
			frequency: semitoneToHz(baseHz, tone),
			beat: 0,
			duration: padDuration,
			level: 0.5
		});
	}
	// ヒーロー(見出し)からも 1 音だけ重ねて、画面中央に和音の芯を置く
	notes.push({
		slot: HERO_SLOT,
		kind: 'pad',
		frequency: semitoneToHz(baseHz, chord.tones[0] - 12),
		beat: 0,
		duration: padDuration,
		level: 0.45
	});

	// --- メロディ(作品タイルの位置から鳴る。スクロールで音像が動く) ---
	if (tileSlots.length > 0) {
		const count = 2 + Math.floor(random() * 2);
		const steps = [...KEY_CANDIDATE_STEPS].sort(() => random() - 0.5).slice(0, count);
		for (const [index, step] of steps.sort((a, b) => a - b).entries()) {
			const tileIndex = (bar + index) % tileSlots.length;
			notes.push({
				slot: tileSlots[tileIndex],
				kind: 'key',
				frequency: tileNote(tileHues[tileIndex] ?? 0, chord, baseHz, octaveRange),
				beat: swung(step),
				duration: 0.9,
				level: 0.55 + random() * 0.2
			});
		}
	}

	return notes;
}

/**
 * 指定した時間帯 [from, to) に鳴る音を、音楽開始からの秒数付きで返す。
 * 先読みスケジューラはこれを一定間隔で呼ぶだけでよい。
 */
export function notesInWindow(from: number, to: number, options: ChillOptions): Note[] {
	const secondsPerBeat = 60 / options.bpm;
	const barSeconds = BEATS_PER_BAR * secondsPerBeat;
	const firstBar = Math.max(0, Math.floor(from / barSeconds));
	const lastBar = Math.floor(to / barSeconds);
	const notes: Note[] = [];

	for (let bar = firstBar; bar <= lastBar; bar += 1) {
		const barStart = bar * barSeconds;
		for (const { beat, ...rest } of barNotes(bar, options)) {
			const time = barStart + beat * secondsPerBeat;
			if (time < from || time >= to) continue;
			notes.push({ ...rest, time });
		}
	}

	return notes.sort((a, b) => a.time - b.time);
}
