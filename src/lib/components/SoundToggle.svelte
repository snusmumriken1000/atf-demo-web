<!--
	空間オーディオのオン / オフを切り替えるトグル。

	方針:
	- 既定は無音。ユーザーがこのボタンを押すまで AudioContext を作らない
	  (ブラウザの自動再生制限に正面から適合し、WCAG 1.4.2 の停止手段も満たす)
	- AudioContext を持たないブラウザでは何も描画しない(段階的強化)
	- 判定はクライアントでしかできないため、マウント後にだけ描画する。
	  prerender された HTML と初期描画を一致させ、ちらつきを避けるための順序
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { soundState } from '$lib/audio/soundState.svelte';
	import { isSpatialAudioSupported } from '$lib/audio/spatialAudioEngine';
	import { content } from '$lib/data/content';

	const { audio } = content;

	let supported = $state(false);

	onMount(() => {
		supported = isSpatialAudioSupported();
		// 前回の訪問で音を有効にしていたなら、その意思を復元する
		soundState.hydrate();
	});
</script>

{#if supported}
	<div class="sound">
		<button
			type="button"
			class="toggle"
			aria-pressed={soundState.enabled}
			onclick={() => soundState.toggle()}
		>
			<!-- 再生中だけ動くイコライザ。装飾なので支援技術からは隠す -->
			<span class="bars" aria-hidden="true">
				<span></span><span></span><span></span>
			</span>
			<span>{audio.label}</span>
			<!-- 見えているラベル(Sound)に操作の説明を足して読み上げる -->
			<span class="sr-only">
				{soundState.enabled ? audio.disableLabel : audio.enableLabel}
			</span>
		</button>
		<p class="hint">{audio.hint}</p>
	</div>
{/if}

<style>
	.sound {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-1);
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--color-fg-muted);
		border-radius: 999px;
		background: var(--color-bg);
		color: var(--color-fg);
		font-family: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		transition: border-color var(--motion-duration) ease;
	}

	.toggle:hover {
		border-color: var(--color-accent);
	}

	.toggle:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	/* イコライザ: 停止中は低い 3 本、再生中だけ上下する */
	.bars {
		display: inline-flex;
		align-items: flex-end;
		gap: 2px;
		height: 0.75em;
	}

	.bars span {
		width: 2px;
		height: 30%;
		background: var(--color-fg-muted);
		transition: height var(--motion-duration) ease;
	}

	.toggle[aria-pressed='true'] .bars span {
		background: var(--color-accent);
		animation: sound-bar var(--motion-sound-pulse) ease-in-out infinite;
	}

	.toggle[aria-pressed='true'] .bars span:nth-child(2) {
		animation-delay: calc(var(--motion-sound-pulse) / 3);
	}

	.toggle[aria-pressed='true'] .bars span:nth-child(3) {
		animation-delay: calc(var(--motion-sound-pulse) / 3 * 2);
	}

	@keyframes sound-bar {
		0%,
		100% {
			height: 30%;
		}
		50% {
			height: 100%;
		}
	}

	.hint {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-fg-muted);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
