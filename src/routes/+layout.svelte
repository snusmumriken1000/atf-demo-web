<script lang="ts">
	import '$lib/styles/global.css';
	import favicon from '$lib/assets/favicon.svg';
	// preload の href は Vite のハッシュ付き URL に追従させるため必ず import 経由にする
	import fontUrl from '$lib/assets/fonts/space-grotesk-latin-var.woff2';
	import FaceSwitcher from '$lib/components/FaceSwitcher.svelte';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';

	let { children } = $props();

	// ページ間フェード(View Transitions API)。時間・イージングは global.css の
	// ::view-transition-* が motion トークンを参照する。非対応ブラウザは即時遷移(段階的強化)。
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={fontUrl} />
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
