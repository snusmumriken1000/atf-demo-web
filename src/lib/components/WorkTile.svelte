<!--
	作品タイル(面 1 の作品バンドで使用)。ビジュアル + 作品名 + 一行説明。
	ビジュアル部は現状プレースホルダとして hue から控えめなグラデーションを生成している。
	実画像が用意できたら image / imageAlt を渡すだけで <img> に置き換わる。
-->
<script lang="ts">
	import type { Work } from '$lib/data/works';

	let {
		work,
		image,
		imageAlt = ''
	}: {
		work: Work;
		/** 実画像のパス(import した URL)。省略時は hue から生成するグラデーション */
		image?: string;
		imageAlt?: string;
	} = $props();
</script>

{#snippet body()}
	{#if image}
		<img class="visual" src={image} alt={imageAlt} />
	{:else}
		<div class="visual placeholder" style:--tile-hue={work.hue} aria-hidden="true"></div>
	{/if}
	<h3>{work.title}</h3>
	<p>{work.blurb}</p>
{/snippet}

<article class="tile">
	{#if work.href}
		<!-- href は「resolve() 済みの内部パス」または「外部 URL」を渡す契約(works.ts 参照) -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={work.href}>{@render body()}</a>
	{:else}
		{@render body()}
	{/if}
</article>

<style>
	.visual {
		aspect-ratio: 4 / 3;
		width: 100%;
		border-radius: var(--space-2);
		object-fit: cover;
	}

	/* hue 値から生成する控えめなグラデーション(容量ゼロのプレースホルダ) */
	.placeholder {
		background: linear-gradient(
			135deg,
			hsl(var(--tile-hue) 45% 26%),
			hsl(calc(var(--tile-hue) + 40) 55% 12%)
		);
	}

	h3 {
		margin-top: var(--space-3);
		font-size: var(--text-lg);
		line-height: var(--leading-tight);
	}

	p {
		margin-top: var(--space-1);
		font-size: var(--text-sm);
		color: var(--color-fg-muted);
	}

	a {
		display: block;
		color: inherit;
		text-decoration: none;
	}

	a:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
