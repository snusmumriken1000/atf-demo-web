<!--
	面 1(showcase)の音場。画面には何も描画しない(音の配置と進行だけを担当する)。

	譜面(chillScore.ts)が組み立てた 4 小節ループを先読みしながら鳴らし、
	音の役割ごとに空間上の居場所を与える:

	  リズム / ベース … 正面手前(据わっていてほしいので固定)
	  ハイハット      … 右斜め上(固定)
	  パッド          … 左右に大きく開く(固定)
	  空気感          … 頭上奥(固定)
	  和音の芯        … ヒーロー見出しの位置(スクロールで動く)
	  メロディ        … 各作品タイルの位置(スクロールで動く)

	ポインタを動かすとリスナーの向きが変わり、音像全体が振れる。

	動く条件:
	- soundState.enabled が true のときだけ AudioContext を作る
	- prefers-reduced-motion: reduce のときは音像を動かさない(曲は流れる)
	- タブが隠れている間は suspend して CPU を使わない
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { soundState } from '$lib/audio/soundState.svelte';
	import {
		AIR_SLOT,
		HERO_SLOT,
		notesInWindow,
		PAD_LEFT_SLOT,
		PAD_RIGHT_SLOT,
		PERC_SLOT,
		RHYTHM_SLOT,
		type ChillOptions
	} from '$lib/audio/chillScore';
	import {
		createAudioContext,
		FADE_SECONDS,
		SpatialAudioEngine
	} from '$lib/audio/spatialAudioEngine';
	import {
		driftPhase,
		listenerFromPointer,
		positionForRect,
		proximityLevel,
		type Pointer,
		type Vector3
	} from '$lib/audio/spatialField';

	type Props = {
		/** 作品タイル。id は data-audio-source と対応させる */
		tiles: { id: string; hue: number }[];
		/** テンポ(BPM) */
		bpm: number;
		/** 主音の高さ(Hz) */
		baseHz: number;
		/** メロディが広がる音域(オクターブ数) */
		octaveRange: number;
		/** 全体音量(0〜1) */
		volume: number;
	};

	const { tiles, bpm, baseHz, octaveRange, volume }: Props = $props();

	/**
	 * 位置を固定するスロットと、その置き場所。
	 * リズム系は据わっていてほしいので中央手前、パッドは左右非対称に開いて
	 * 首を振ったときの変化が出るようにしている。
	 */
	const FIXED_SLOTS: { id: string; position: Vector3 }[] = [
		// リズムは正面手前。ここが動くとビートが落ち着かない
		{ id: RHYTHM_SLOT, position: { x: 0, y: -0.2, z: -1.4 } },
		{ id: PERC_SLOT, position: { x: 1.4, y: 0.7, z: -1 } },
		{ id: PAD_LEFT_SLOT, position: { x: -2.8, y: 0.3, z: -1.4 } },
		{ id: PAD_RIGHT_SLOT, position: { x: 2.8, y: 0.1, z: -2.4 } },
		{ id: AIR_SLOT, position: { x: 0, y: 1.2, z: -2.4 } }
	];

	/** 和音の床が 1 周する秒数。長くとってゆっくり漂わせる */
	const DRIFT_PERIOD_SECONDS = 26;
	/** 漂いの振れ幅(メートル相当) */
	const DRIFT_AMOUNT = 1.1;

	// 音像の更新間隔(ms)。AudioParam 側で補間されるため毎フレーム送る必要はない
	const UPDATE_INTERVAL_MS = 50;
	// 譜面の先読み: この間隔で、この秒数だけ先までの音符を予約する
	const SCHEDULE_INTERVAL_MS = 80;
	const LOOKAHEAD_SECONDS = 0.3;

	let engine: SpatialAudioEngine | null = null;
	let frameId = 0;
	let schedulerId: ReturnType<typeof setInterval> | null = null;
	let lastUpdate = 0;
	/** 音楽の開始時刻(AudioContext の時計) */
	let musicStart = 0;
	/** ここまでの音符は予約済み(音楽開始からの秒数) */
	let scheduledUntil = 0;
	let pointer: Pointer | null = null;
	let reducedMotion = false;
	// 画面位置に追従するスロット(表示に使わない単なるキャッシュ)
	let tracked: { id: string; element: Element }[] = [];
	let detachGesture: (() => void) | null = null;

	const scoreOptions = $derived<ChillOptions>({
		bpm,
		baseHz,
		octaveRange,
		tileHues: tiles.map((tile) => tile.hue),
		tileSlots: tiles.map((tile) => tile.id)
	});

	/** 画面位置に追従するスロット(ヒーローと作品タイル)の要素を取り直す */
	function refreshElements() {
		tracked = [];
		for (const id of [HERO_SLOT, ...tiles.map((tile) => tile.id)]) {
			const element = document.querySelector(`[data-audio-source="${id}"]`);
			if (element) tracked.push({ id, element });
		}
	}

	/** 要素の現在位置とポインタから、スロットの位置・音量とリスナーの向きを更新する */
	function update() {
		if (!engine) return;
		const viewport = { width: window.innerWidth, height: window.innerHeight };
		// reduced-motion では音像を動かさないので、ポインタを無視して正面固定にする
		const activePointer = reducedMotion ? null : pointer;

		// 和音の床をゆっくり漂わせる(操作しなくても空間が生きている)
		if (!reducedMotion) {
			const phase = driftPhase(engine.currentTime, DRIFT_PERIOD_SECONDS);
			for (const slot of FIXED_SLOTS) {
				if (slot.id !== PAD_LEFT_SLOT && slot.id !== PAD_RIGHT_SLOT) continue;
				const depth = slot.id === PAD_LEFT_SLOT ? 1 : -1;
				engine.setSlotPosition(slot.id, {
					x: slot.position.x + phase * DRIFT_AMOUNT,
					y: slot.position.y,
					z: slot.position.z - phase * DRIFT_AMOUNT * 0.5 * depth
				});
			}
		}

		for (const { id, element } of tracked) {
			const rect = element.getBoundingClientRect();
			engine.setSlotPosition(id, positionForRect(rect, viewport));
			engine.setSlotLevel(id, proximityLevel(rect, activePointer, viewport));
		}
		engine.setListener(listenerFromPointer(activePointer, viewport));
	}

	function loop(time: number) {
		frameId = requestAnimationFrame(loop);
		if (time - lastUpdate < UPDATE_INTERVAL_MS) return;
		lastUpdate = time;
		update();
	}

	/** 先読みして音符を予約する。suspend 中は時計が止まるので何も予約されない */
	function schedule() {
		const current = engine;
		if (!current) return;
		const horizon = current.currentTime - musicStart + LOOKAHEAD_SECONDS;
		if (horizon <= scheduledUntil) return;

		for (const note of notesInWindow(scheduledUntil, horizon, scoreOptions)) {
			current.triggerNote(note, musicStart + note.time);
		}
		scheduledUntil = horizon;
	}

	function handlePointerMove(event: PointerEvent) {
		pointer = { x: event.clientX, y: event.clientY };
	}

	function handlePointerLeave() {
		pointer = null;
	}

	function handleResize() {
		refreshElements();
		update();
	}

	function handleVisibilityChange() {
		if (!engine) return;
		if (document.hidden) void engine.suspend();
		else void engine.resume();
	}

	function attachListeners() {
		window.addEventListener('pointermove', handlePointerMove, { passive: true });
		window.addEventListener('pointerleave', handlePointerLeave);
		window.addEventListener('resize', handleResize);
		document.addEventListener('visibilitychange', handleVisibilityChange);
	}

	function detachListeners() {
		window.removeEventListener('pointermove', handlePointerMove);
		window.removeEventListener('pointerleave', handlePointerLeave);
		window.removeEventListener('resize', handleResize);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
	}

	/*
	 * 前回の訪問で音を有効にしていた場合、再読み込み直後はユーザー操作がないため
	 * AudioContext が suspended のまま作られる。最初の操作で一度だけ復帰させる。
	 */
	function armGestureResume(target: SpatialAudioEngine) {
		const resume = () => {
			detachGesture?.();
			detachGesture = null;
			void target.resume();
		};
		const events = ['pointerdown', 'keydown', 'touchstart'] as const;
		for (const type of events) window.addEventListener(type, resume, { once: true });
		detachGesture = () => {
			for (const type of events) window.removeEventListener(type, resume);
		};
	}

	async function start() {
		if (engine) return;
		const context = createAudioContext();
		if (!context) return;

		const started = new SpatialAudioEngine(context, volume);
		engine = started;

		for (const slot of FIXED_SLOTS) {
			started.addSlot(slot.id);
			started.setSlotPosition(slot.id, slot.position);
		}
		for (const id of [HERO_SLOT, ...tiles.map((tile) => tile.id)]) started.addSlot(id);
		// レコードのノイズのような薄い層。ビートの隙間を埋める
		started.startAmbience(AIR_SLOT, baseHz * 6);

		refreshElements();
		update(); // 鳴り始める前に正しい位置へ置く(中央から始まらないように)
		attachListeners();

		// フェードインと同時に 1 小節目から流し始める
		musicStart = started.currentTime + 0.15;
		scheduledUntil = 0;
		schedule();
		schedulerId = setInterval(schedule, SCHEDULE_INTERVAL_MS);

		await started.fadeIn();
		if (context.state !== 'running') armGestureResume(started);

		frameId = requestAnimationFrame(loop);
	}

	function stop() {
		const current = engine;
		if (!current) return;
		engine = null;

		if (schedulerId !== null) clearInterval(schedulerId);
		schedulerId = null;
		cancelAnimationFrame(frameId);
		frameId = 0;
		detachListeners();
		detachGesture?.();
		detachGesture = null;

		// フェードアウトを聞かせてから破棄する
		void current.fadeOut();
		setTimeout(() => void current.dispose(), FADE_SECONDS * 1000);
	}

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		soundState.hydrate();
		// 面を離れる(コンポーネントが壊される)ときは必ず止める
		return () => stop();
	});

	$effect(() => {
		if (soundState.enabled) void start();
		else stop();
	});
</script>
