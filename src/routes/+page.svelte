<!--
	入口ページ。2 つの面(Showcase / Profile)を選ぶ「静かな 2 分割」のスプリット画面。
	面 1 と同じダークトーン(tokens.css の body:has 反転)で第一印象を一貫させる。
	入場フェードは showcase のヒーローと同じ CSS パターン(rise + stagger)。
-->
<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>atf-demo-web</title>
</svelte:head>

<section class="entry" data-face="entry">
	<header class="rise">
		<h1>atf-demo-web</h1>
		<p>2 つの面をもつポートフォリオサイト。見たい面を選んでください。</p>
	</header>

	<nav aria-label="面の選択">
		<a class="rise" href={resolve('/showcase')}>
			<h2>Showcase</h2>
			<p>ビジュアルで感じる面</p>
		</a>
		<a class="rise" href={resolve('/profile')}>
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
		font-size: var(--text-3xl);
		line-height: var(--leading-tight);
		letter-spacing: -0.02em;
	}

	header p {
		margin-top: var(--space-3);
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

	/* カードを画面の主役にする(静かな 2 分割) */
	nav a {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-height: 40vh;
		padding: var(--space-6);
		border: 1px solid color-mix(in srgb, var(--color-fg-muted) 35%, transparent);
		border-radius: var(--space-2);
		color: var(--color-fg);
		text-decoration: none;
		transition:
			border-color var(--motion-duration) var(--motion-ease),
			background-color var(--motion-duration) var(--motion-ease);
	}

	nav a:hover {
		border-color: var(--color-accent);
		background-color: var(--color-surface);
	}

	nav a:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	nav h2 {
		font-size: var(--text-xl);
		line-height: var(--leading-tight);
		transition: color var(--motion-duration) var(--motion-ease);
	}

	nav a:hover h2 {
		color: var(--color-accent);
	}

	nav p {
		margin-top: var(--space-2);
		font-size: var(--text-sm);
		color: var(--color-fg-muted);
	}

	/* 入場フェード(showcase のヒーローと同じパターン)。h1 → カード の順に stagger */
	@keyframes rise-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	.rise {
		animation: rise-in var(--motion-duration-fade) var(--motion-ease) backwards;
	}

	nav a.rise:nth-child(1) {
		animation-delay: var(--motion-stagger);
	}

	nav a.rise:nth-child(2) {
		animation-delay: calc(var(--motion-stagger) * 2);
	}
</style>
