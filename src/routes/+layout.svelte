<script lang="ts">
	import '$lib/styles/global.css';
	import favicon from '$lib/assets/favicon.svg';
	import FaceSwitcher from '$lib/components/FaceSwitcher.svelte';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip-link" href="#main">本文へスキップ</a>

<!-- 面ページのみ切り替え導線を出す(入口 / では非表示)。判定は route.id で行う -->
{#if page.route.id !== '/'}
	<FaceSwitcher />
{/if}

<main id="main">
	{@render children()}
</main>

<style>
	/* キーボード操作時のみ表示されるスキップリンク */
	.skip-link {
		position: fixed;
		top: var(--space-2);
		left: var(--space-2);
		z-index: var(--z-nav);
		padding: var(--space-1) var(--space-3);
		background: var(--color-bg);
		color: var(--color-fg);
		transform: translateY(calc(-100% - var(--space-4)));
	}

	.skip-link:focus-visible {
		transform: none;
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
