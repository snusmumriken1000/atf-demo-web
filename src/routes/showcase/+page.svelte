<!--
	面 1(ビジュアル特化の面)。
	自己紹介ステートメントを主役に、作品ビジュアルを添えるダーク・ミニマル構成。
	入場フェードは CSS アニメーションのみ(prerender された HTML の paint 直後に開始)、
	作品タイルのスクロール出現は fadeInOnView attachment。時間はすべて motion トークン経由。
	表示文言はすべて src/lib/data/content.ts が単一ソース。
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import WorkTile from '$lib/components/WorkTile.svelte';
	import DrawingHand from '$lib/components/DrawingHand.svelte';
	import SketchStroke from '$lib/components/SketchStroke.svelte';
	import { handDrawnSequence } from '$lib/attachments/handDrawnSequence';
	import SpatialAudioScene from '$lib/components/SpatialAudioScene.svelte';
	import type { SpatialSourceSpec } from '$lib/audio/spatialAudioEngine';
	import { hueToFrequency } from '$lib/audio/spatialField';
	import { content } from '$lib/data/content';

	const { site, hero, audio } = content;
	// タイルに出す作品: featured 指定があればそれ、なければ先頭から。最大 4 件
	const featured = content.works.filter((work) => work.featured);
	const tiles = (featured.length > 0 ? featured : content.works).slice(0, 4);
	// ステートメントは \n の位置で改行して大見出しにする
	const statementLines = hero.statement.split('\n');

	/*
	 * 音場の構成。id は data-audio-source と対応し、その要素の画面位置から鳴る。
	 * - hero: 正面に置く低いドローン(この面の土台になる音)
	 * - 作品: 高さは hue から決まるので、タイルの色と音程が対応する
	 * - air: 要素を持たない環境音。頭上やや奥に固定で置く
	 */
	const audioSources: SpatialSourceSpec[] = [
		{ id: 'hero', kind: 'drone', frequency: audio.baseHz / 2 },
		...tiles.map((work): SpatialSourceSpec => ({
			id: work.id,
			kind: 'tone',
			frequency: hueToFrequency(work.hue, audio.baseHz, audio.octaveRange)
		})),
		{ id: 'air', kind: 'air', frequency: audio.baseHz * 6 }
	];
</script>

<svelte:head>
	<title>{site.faces.showcase.label} | {site.title}</title>
</svelte:head>

<section class="showcase" data-face="visual" {@attach handDrawnSequence()}>
	<DrawingHand />
	<SpatialAudioScene sources={audioSources} volume={audio.volume} />
	<header class="hero" data-audio-source="hero">
		<p class="eyebrow draw-step" data-draw-step="eyebrow">{hero.name}<SketchStroke /></p>
		<h1 class="statement">
			{#each statementLines as line, index (index)}
				{#if index > 0}<br />{/if}<span
					class="statement-line draw-step"
					data-draw-step={`statement-${index + 1}`}>{line}<SketchStroke /></span
				>
			{/each}
		</h1>
		<p class="lead draw-step" data-draw-step="lead">{site.faces.showcase.lead}<SketchStroke /></p>
		<!-- 下の作品バンドへのスクロール示唆(装飾のみ) -->
		<p class="hint draw-step" data-draw-step="hint" aria-hidden="true">
			{site.navigation.scrollHint}<SketchStroke />
		</p>
	</header>

	<section class="works" aria-labelledby="showcase-works-heading">
		<h2 class="works-title draw-step" data-draw-step="works-heading" id="showcase-works-heading">
			{hero.worksLabel}<SketchStroke />
		</h2>
		<ul>
			{#each tiles as work, index (work.id)}
				<li
					class="draw-step"
					data-draw-kind="card"
					data-draw-step={`work-${index + 1}`}
					data-audio-source={work.id}
				>
					<!-- タイルから面 2 の該当作品詳細(/profile#work-{id})へ -->
					<div data-draw-content>
						<WorkTile {work} href={resolve('/profile') + '#work-' + work.id} />
					</div>
					<SketchStroke kind="outline" />
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

	.statement-line,
	.draw-step {
		position: relative;
	}

	.statement-line {
		display: inline-block;
	}

	.showcase:not([data-drawing-state='active']) :global([data-drawing-hand]) {
		display: none;
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

	li {
		position: relative;
	}

	[data-draw-content] {
		display: block;
	}
</style>
