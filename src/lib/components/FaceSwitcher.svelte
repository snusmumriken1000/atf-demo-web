<!--
	面ページ(/showcase・/profile)専用の切り替え導線。
	入口(/)へ戻るリンクと、もう一方の面へのリンクの 2 つだけを置く。

	注意: 現在地の判定は page.route.id で行うこと。pathname の文字列比較は
	#6 で paths.base を導入したときに壊れるため使用しない。
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SoundToggle from '$lib/components/SoundToggle.svelte';
	import { content } from '$lib/data/content';

	// もう一方の面へのリンク先を route.id から決める
	const other = $derived(
		page.route.id === '/showcase'
			? { href: resolve('/profile'), label: content.site.faces.profile.label }
			: { href: resolve('/showcase'), label: content.site.faces.showcase.label }
	);

	// 音は面 1(showcase)だけの体験にする。面 2 は落ち着いて読む面なので出さない
	const showsSound = $derived(page.route.id === '/showcase');
</script>

<div class="face-controls">
	<nav class="face-switcher" aria-label={content.site.navigation.switcherLabel}>
		<a href={resolve('/')}>← {content.site.navigation.top}</a>
		<a href={other.href}>{other.label}</a>
	</nav>
	{#if showsSound}
		<SoundToggle />
	{/if}
</div>

<style>
	.face-controls {
		position: fixed;
		top: var(--space-2);
		right: var(--space-2);
		z-index: var(--z-nav);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-2);
	}

	.face-switcher {
		display: flex;
		gap: var(--space-2);
	}

	a {
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--color-fg-muted);
		border-radius: 999px;
		background: var(--color-bg);
		color: var(--color-fg);
		font-size: var(--text-sm);
		text-decoration: none;
		transition: border-color var(--motion-duration) ease;
	}

	a:hover {
		border-color: var(--color-accent);
	}

	a:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
