import { describe, expect, it } from 'vitest';
import {
	AIR_SLOT,
	BEATS_PER_BAR,
	barNotes,
	chordForBar,
	HERO_SLOT,
	notesInWindow,
	PAD_LEFT_SLOT,
	PAD_RIGHT_SLOT,
	PERC_SLOT,
	PROGRESSION,
	RHYTHM_SLOT,
	semitoneToHz,
	tileNote,
	type ChillOptions
} from './chillScore';

const options: ChillOptions = {
	bpm: 74,
	baseHz: 130.81,
	octaveRange: 2,
	tileHues: [215, 265, 160, 20],
	tileSlots: ['work-a', 'work-b', 'work-c', 'work-d']
};

const barSeconds = (bpm: number) => BEATS_PER_BAR * (60 / bpm);

describe('chordForBar', () => {
	it('4 小節で 1 周する', () => {
		expect(chordForBar(0)).toBe(chordForBar(4));
		expect(chordForBar(1).name).toBe(PROGRESSION[1].name);
	});

	it('負の小節番号でも進行から外れない', () => {
		expect(PROGRESSION).toContain(chordForBar(-1));
	});
});

describe('semitoneToHz', () => {
	it('12 半音で 1 オクターブ(2 倍)になる', () => {
		expect(semitoneToHz(100, 12)).toBeCloseTo(200, 5);
		expect(semitoneToHz(100, -12)).toBeCloseTo(50, 5);
	});
});

describe('tileNote', () => {
	it('必ずそのコードの構成音になる(和音から外れない)', () => {
		for (const chord of PROGRESSION) {
			for (const hue of [0, 45, 90, 180, 270, 359]) {
				const frequency = tileNote(hue, chord, options.baseHz, options.octaveRange);
				const semitone = Math.round(12 * Math.log2(frequency / options.baseHz));
				const allowed = chord.tones.flatMap((tone) => [tone, tone + 12]);
				expect(allowed).toContain(semitone);
			}
		}
	});

	it('色相が上がるほど高い音を選ぶ(色と音の対応を保つ)', () => {
		const chord = PROGRESSION[2];
		const low = tileNote(10, chord, options.baseHz, options.octaveRange);
		const high = tileNote(350, chord, options.baseHz, options.octaveRange);

		expect(high).toBeGreaterThan(low);
	});

	it('360 以上・負の色相も丸めて扱う', () => {
		const chord = PROGRESSION[0];
		expect(tileNote(360, chord, 130.81, 2)).toBeCloseTo(tileNote(0, chord, 130.81, 2), 5);
		expect(tileNote(-40, chord, 130.81, 2)).toBeCloseTo(tileNote(320, chord, 130.81, 2), 5);
	});
});

describe('barNotes', () => {
	it('同じ小節番号なら必ず同じ譜面になる(再生ごとにぶれない)', () => {
		expect(barNotes(3, options)).toEqual(barNotes(3, options));
	});

	it('小節ごとにメロディの並びが変わる(4 小節の丸暗記に聞こえない)', () => {
		const keysOf = (bar: number) =>
			barNotes(bar, options)
				.filter((note) => note.kind === 'key')
				.map((note) => `${note.slot}@${note.beat}`)
				.join(',');

		expect(keysOf(0)).not.toBe(keysOf(1));
	});

	it('リズムとベースは正面の固定スロットから鳴らす', () => {
		const notes = barNotes(0, options);
		const rhythmKinds = new Set(
			notes.filter((note) => note.slot === RHYTHM_SLOT).map((note) => note.kind)
		);

		expect(rhythmKinds).toEqual(new Set(['kick', 'snare', 'bass']));
		expect(notes.filter((note) => note.kind === 'hat').every((n) => n.slot === PERC_SLOT)).toBe(
			true
		);
	});

	it('パッドは左右に振り分け、ヒーローにも芯を置く', () => {
		const pads = barNotes(0, options).filter((note) => note.kind === 'pad');
		const slots = new Set(pads.map((note) => note.slot));

		expect(slots).toContain(PAD_LEFT_SLOT);
		expect(slots).toContain(PAD_RIGHT_SLOT);
		expect(slots).toContain(HERO_SLOT);
	});

	it('メロディは作品タイルのスロットからだけ鳴る', () => {
		const keys = barNotes(2, options).filter((note) => note.kind === 'key');

		expect(keys.length).toBeGreaterThan(0);
		expect(keys.every((note) => options.tileSlots.includes(note.slot))).toBe(true);
	});

	it('作品がなくてもリズムとパッドは成立する', () => {
		const notes = barNotes(0, { ...options, tileHues: [], tileSlots: [] });

		expect(notes.some((note) => note.kind === 'kick')).toBe(true);
		expect(notes.every((note) => note.kind !== 'key')).toBe(true);
	});

	it('すべての音が小節の中に収まり、音量が範囲内にある', () => {
		const notes = barNotes(1, options);

		expect(notes.every((note) => note.beat >= 0 && note.beat < BEATS_PER_BAR)).toBe(true);
		expect(notes.every((note) => note.level > 0 && note.level <= 1)).toBe(true);
		expect(notes.every((note) => note.duration > 0)).toBe(true);
	});

	it('空気感のスロットは譜面では使わない(常時鳴らす層のため)', () => {
		expect(barNotes(0, options).every((note) => note.slot !== AIR_SLOT)).toBe(true);
	});
});

describe('notesInWindow', () => {
	it('窓の中の音だけを、時間順に返す', () => {
		const bar = barSeconds(options.bpm);
		const notes = notesInWindow(0, bar, options);

		expect(notes.every((note) => note.time >= 0 && note.time < bar)).toBe(true);
		expect(notes.map((note) => note.time)).toEqual(
			[...notes.map((note) => note.time)].sort((a, b) => a - b)
		);
	});

	it('窓を継ぎ足しても音が重複せず、抜けもしない', () => {
		const bar = barSeconds(options.bpm);
		const whole = notesInWindow(0, bar * 2, options);
		const split = [
			...notesInWindow(0, bar * 0.7, options),
			...notesInWindow(bar * 0.7, bar * 1.3, options),
			...notesInWindow(bar * 1.3, bar * 2, options)
		];

		expect(split).toEqual(whole);
	});

	it('小節をまたいでコードが変わる', () => {
		const bar = barSeconds(options.bpm);
		const bassOf = (index: number) =>
			notesInWindow(bar * index, bar * (index + 1), options).find((note) => note.kind === 'bass')
				?.frequency;

		expect(bassOf(0)).not.toBe(bassOf(1));
	});

	it('テンポを上げると同じ秒数により多くの音が入る', () => {
		const slow = notesInWindow(0, 10, { ...options, bpm: 60 });
		const fast = notesInWindow(0, 10, { ...options, bpm: 120 });

		expect(fast.length).toBeGreaterThan(slow.length);
	});

	it('長さ 0 の窓では何も返さない', () => {
		expect(notesInWindow(5, 5, options)).toEqual([]);
	});
});
