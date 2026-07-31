<!--
	入口ページ。2 つの面(Showcase / Profile)を選ぶスプリット画面。
	ここでは構造と導線のみを確立し、装飾は最小限に留める。
	スプリット画面としての見せ方(ビジュアル・演出)は #3 で磨く。
-->
<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>atf-demo-web</title>
</svelte:head>

<section class="entry" data-face="entry">
	<header>
		<h1>atf-demo-web</h1>
		<p>2 つの面をもつポートフォリオサイト。見たい面を選んでください。</p>
	</header>

	<nav aria-label="面の選択">
		<a href={resolve('/showcase')}>
			<h2>Showcase</h2>
			<p>ビジュアルで感じる面</p>
		</a>
		<a href={resolve('/profile')}>
			<h2>Profile</h2>
			<p>経歴・スキル・作品を読む面</p>
		</a>
	</nav>
</section>

<style>
	.entry {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--space-8);
		padding: var(--space-8) var(--space-4);
	}

	header {
		text-align: center;
	}

	h1 {
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
	}

	header p {
		margin-top: var(--space-2);
		color: var(--color-fg-muted);
	}

	nav {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
		max-width: 48rem;
		width: 100%;
		margin: 0 auto;
	}

	/* 狭幅では縦積みにする(DOM 順 = 視覚順を維持) */
	@media (max-width: 40rem) {
		nav {
			grid-template-columns: 1fr;
		}
	}

	nav a {
		display: block;
		padding: var(--space-6);
		border: 1px solid var(--color-fg-muted);
		border-radius: var(--space-2);
		color: var(--color-fg);
		text-decoration: none;
		transition: border-color var(--motion-duration) ease;
	}

	nav a:hover {
		border-color: var(--color-accent);
	}

	nav a:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	nav h2 {
		font-size: var(--text-lg);
		line-height: var(--leading-tight);
	}

	nav p {
		margin-top: var(--space-2);
		font-size: var(--text-sm);
		color: var(--color-fg-muted);
	}
</style>
