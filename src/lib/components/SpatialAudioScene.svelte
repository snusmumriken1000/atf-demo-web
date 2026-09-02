<!--
	面 1(showcase)の音場。画面には何も描画しない(音の配置だけを担当する)。

	data-audio-source="<id>" が付いた要素の画面位置を毎フレーム 3D 座標へ写し、
	ポインタ位置をリスナーの向きに反映する。見えている配置と聞こえる配置が
	一致するので、スクロールすると作品が音ごと近づいてくる。

	動く条件:
	- soundState.enabled が true のときだけ AudioContext を作る
	- prefers-reduced-motion: reduce のときは音像を動かさない(音は鳴る)
	- タブが隠れている間は suspend して CPU を使わない
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { soundState } from '$lib/audio/soundState.svelte';
	import {
		createAudioContext,
		FADE_SECONDS,
		SpatialAudioEngine,
		type SpatialSourceSpec
	} from '$lib/audio/spatialAudioEngine';
	import {
		listenerFromPointer,
		positionForRect,
		proximityLevel,
		type Pointer
	} from '$lib/audio/spatialField';

	type Props = {
		/** 鳴らす音源。id は data-audio-source と対応させる */
		sources: SpatialSourceSpec[];
		/** 全体音量(0〜1) */
		volume: number;
	};

	const { sources, volume }: Props = $props();

	// 音像の更新間隔(ms)。AudioParam 側で補間されるため毎フレーム送る必要はない
	const UPDATE_INTERVAL_MS = 50;

	let engine: SpatialAudioEngine | null = null;
	let frameId = 0;
	let lastUpdate = 0;
	let pointer: Pointer | null = null;
	let reducedMotion = false;
	// 音源 id と DOM 要素の対応(表示に使わない単なるキャッシュ)
	let elements: { id: string; element: Element }[] = [];
	let detachGesture: (() => void) | null = null;

	/** 音源 id と DOM 要素の対応を取り直す */
	function refreshElements() {
		elements = [];
		for (const spec of sources) {
			const element = document.querySelector(`[data-audio-source="${spec.id}"]`);
			if (element) elements.push({ id: spec.id, element });
		}
	}

	/** 要素の現在位置とポインタから、音源の位置・音量とリスナーの向きを更新する */
	function update() {
		if (!engine) return;
		const viewport = { width: window.innerWidth, height: window.innerHeight };
		// reduced-motion では音像を動かさないので、ポインタを無視して正面固定にする
		const activePointer = reducedMotion ? null : pointer;

		for (const { id, element } of elements) {
			const rect = element.getBoundingClientRect();
			engine.setSourcePosition(id, positionForRect(rect, viewport));
			engine.setSourceLevel(id, proximityLevel(rect, activePointer, viewport));
		}
		engine.setListener(listenerFromPointer(activePointer, viewport));
	}

	function loop(time: number) {
		frameId = requestAnimationFrame(loop);
		if (time - lastUpdate < UPDATE_INTERVAL_MS) return;
		lastUpdate = time;
		update();
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
		for (const spec of sources) started.addSource(spec);

		refreshElements();
		update(); // フェードインの前に正しい位置へ置く(中央から始まらないように)
		attachListeners();

		await started.fadeIn();
		if (context.state !== 'running') armGestureResume(started);

		frameId = requestAnimationFrame(loop);
	}

	function stop() {
		const current = engine;
		if (!current) return;
		engine = null;

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
