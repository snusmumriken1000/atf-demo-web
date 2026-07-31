<!--
	面 1(ビジュアル特化の面)。
	自己紹介ステートメントを主役に、作品ビジュアルを添えるダーク・ミニマル構成。
	入場フェードは CSS アニメーションのみ(prerender された HTML の paint 直後に開始)、
	作品タイルのスクロール出現は fadeInOnView attachment。時間はすべて motion トークン経由。
	名前・ステートメントの文言はプレースホルダ(オーナーが差し替える前提)。
-->
<script lang="ts">
	import WorkTile from '$lib/components/WorkTile.svelte';
	import { fadeInOnView } from '$lib/attachments/fadeInOnView';
	import { works } from '$lib/data/works';
</script>

<svelte:head>
	<title>Showcase | atf-demo-web</title>
</svelte:head>

<section class="showcase" data-face="visual">
	<header class="hero">
		<p class="eyebrow rise">atf-demo-web — Portfolio</p>
		<h1 class="statement rise">
			Quiet code,<br />
			vivid work.
		</h1>
		<p class="lead rise">静かなコードで、鮮やかなものをつくる。その途中経過を並べた面です。</p>
		<!-- 下の作品バンドへのスクロール示唆(装飾のみ) -->
		<p class="hint rise" aria-hidden="true">Scroll ↓</p>
	</header>

	<section class="works" aria-label="作品">
		<h2 class="works-title">Works</h2>
		<ul>
			{#each works as work (work.title)}
				<li {@attach fadeInOnView()}>
					<WorkTile {work} />
				</li>
			{/each}
		</ul>
	</section>
</section>

<style>
	.showcase {
		min-height: 100dvh;
	}

	/* ---- セクション 1: ヒーロー(ステートメント主役) ---- */

	.hero {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-8) var(--space-4);
		text-align: center;
	}

	.eyebrow {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-fg-muted);
	}

	.statement {
		font-size: var(--text-4xl);
		line-height: var(--leading-tight);
		letter-spacing: -0.02em;
	}

	@media (max-width: 40rem) {
		.statement {
			font-size: var(--text-3xl);
		}
	}

	.lead {
		max-width: 32rem;
		color: var(--color-fg-muted);
	}

	.hint {
		position: absolute;
		bottom: var(--space-6);
		left: 0;
		right: 0;
		font-family: var(--font-display);
		font-size: var(--text-sm);
		color: var(--color-fg-muted);
	}

	/* 入場フェード(opacity + わずかな上昇)。要素間は --motion-stagger でずらす */
	@keyframes rise-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	.rise {
		animation: rise-in var(--motion-duration-fade) var(--motion-ease) backwards;
	}

	.statement.rise {
		animation-delay: var(--motion-stagger);
	}

	.lead.rise {
		animation-delay: calc(var(--motion-stagger) * 2);
	}

	.hint.rise {
		animation-delay: calc(var(--motion-stagger) * 3);
	}

	/* ---- セクション 2: 作品バンド ---- */

	.works {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4) calc(var(--space-8) * 2);
	}

	.works-title {
		font-size: var(--text-xl);
		line-height: var(--leading-tight);
		letter-spacing: 0.04em;
	}

	ul {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: var(--space-6);
		margin-top: var(--space-6);
		padding: 0;
	}
</style>
