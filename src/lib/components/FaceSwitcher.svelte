<!--
	面ページ(/showcase・/profile)専用の切り替え導線。
	入口(/)へ戻るリンクと、もう一方の面へのリンクの 2 つだけを置く。

	注意: 現在地の判定は page.route.id で行うこと。pathname の文字列比較は
	#6 で paths.base を導入したときに壊れるため使用しない。
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// もう一方の面へのリンク先を route.id から決める
	const other = $derived(
		page.route.id === '/showcase'
			? { href: resolve('/profile'), label: 'Profile' }
			: { href: resolve('/showcase'), label: 'Showcase' }
	);
</script>

<nav class="face-switcher" aria-label="面の切り替え">
	<a href={resolve('/')}>← Top</a>
	<a href={other.href}>{other.label}</a>
</nav>

<style>
	.face-switcher {
		position: fixed;
		top: var(--space-2);
		right: var(--space-2);
		z-index: var(--z-nav);
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
