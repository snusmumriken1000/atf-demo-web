<!--
	面 3 の話し相手。丸くて白い、無機質だけれど親しみのある生き物。

	画像ファイルは使わずインライン SVG で描く(外部リソース非依存の方針)。
	動きは 3 つだけに絞って「生きている感じ」を出す:
	  呼吸  … 体がゆっくり上下する(常時)
	  まばたき … ときどき目が閉じる(常時)
	  応答  … 答えるときに一瞬だけ体が沈み、光の輪が広がる

	時間はすべて motion トークン経由なので、prefers-reduced-motion では
	global.css がトークンを 0ms に潰し、動きが止まって静止画になる。
-->
<script lang="ts">
	type Props = {
		/** 'talking' のあいだは応答の動きをする */
		state?: 'idle' | 'talking';
		/** 生き物の名前(content.ts の ask.botName) */
		name: string;
		/** 見た目の説明(読み上げ用) */
		description: string;
	};

	const { state = 'idle', name, description }: Props = $props();
</script>

<figure class="companion" data-state={state}>
	<svg
		viewBox="0 0 120 120"
		role="img"
		aria-labelledby="companion-title"
		aria-describedby="companion-desc"
	>
		<title id="companion-title">{name}</title>
		<desc id="companion-desc">{description}</desc>

		<defs>
			<!-- 体のやわらかい陰影。単色だとのっぺりして生き物に見えない -->
			<radialGradient id="companion-body" cx="38%" cy="30%" r="78%">
				<stop offset="0%" stop-color="var(--companion-highlight)" />
				<stop offset="70%" stop-color="var(--companion-body)" />
				<stop offset="100%" stop-color="var(--companion-shade)" />
			</radialGradient>
		</defs>

		<!-- 応答のときだけ広がる光の輪 -->
		<circle class="halo" cx="60" cy="62" r="44" />

		<g class="figure">
			<!-- 短い腕。体の後ろに置いて輪郭を邪魔しない -->
			<ellipse class="arm" cx="21" cy="74" rx="9" ry="13" />
			<ellipse class="arm" cx="99" cy="74" rx="9" ry="13" />
			<!-- 体。真円より少し縦長にすると「立っている」ように見える -->
			<ellipse class="body" cx="60" cy="64" rx="38" ry="41" />

			<g class="face">
				<ellipse class="eye" cx="47" cy="58" rx="4.6" ry="6.4" />
				<ellipse class="eye" cx="73" cy="58" rx="4.6" ry="6.4" />
			</g>

			<!-- 頭の上の小さな灯。無機質さの中の「謎」の部分 -->
			<circle class="spark" cx="60" cy="17" r="3.4" />
			<line class="stem" x1="60" y1="23" x2="60" y2="30" />
		</g>
	</svg>
</figure>

<style>
	.companion {
		--companion-highlight: #ffffff;
		--companion-body: #e9edf6;
		--companion-shade: #b9c2d6;
		margin: 0;
		width: clamp(6rem, 15vw, 9rem);
		flex-shrink: 0;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.body {
		fill: url(#companion-body);
	}

	.arm {
		fill: var(--companion-shade);
	}

	.eye {
		fill: #1b2333;
	}

	.spark {
		fill: var(--color-accent);
	}

	.stem {
		stroke: var(--companion-shade);
		stroke-width: 2;
		stroke-linecap: round;
	}

	.halo {
		fill: none;
		stroke: var(--color-accent);
		stroke-width: 1.5;
		opacity: 0;
	}

	/* ---- 呼吸: 体全体がゆっくり上下する ---- */
	@keyframes companion-breathe {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-2px) scale(1.015);
		}
	}

	.figure {
		transform-box: fill-box;
		transform-origin: center bottom;
		animation: companion-breathe var(--motion-breathe) ease-in-out infinite;
	}

	/* ---- まばたき: 周期の終わりで一瞬だけ目を閉じる ---- */
	@keyframes companion-blink {
		0%,
		92%,
		100% {
			transform: scaleY(1);
		}
		96% {
			transform: scaleY(0.08);
		}
	}

	.face {
		transform-box: fill-box;
		transform-origin: center;
		animation: companion-blink var(--motion-blink) ease-in-out infinite;
	}

	/* ---- 応答: 一瞬沈んで、光の輪が広がる ---- */
	@keyframes companion-nod {
		0%,
		100% {
			transform: translateY(0) scaleY(1);
		}
		35% {
			transform: translateY(3px) scaleY(0.94);
		}
	}

	@keyframes companion-halo {
		0% {
			opacity: 0.5;
			transform: scale(0.86);
		}
		100% {
			opacity: 0;
			transform: scale(1.12);
		}
	}

	.companion[data-state='talking'] .figure {
		animation:
			companion-nod var(--motion-duration-fade) var(--motion-ease),
			companion-breathe var(--motion-breathe) ease-in-out infinite;
	}

	.companion[data-state='talking'] .halo {
		transform-box: fill-box;
		transform-origin: center;
		animation: companion-halo var(--motion-duration-fade) var(--motion-ease);
	}

	/*
	 * 動きを止める設定では、トークンが 0ms になってアニメーションが効かなくなる。
	 * そのとき目が閉じたままにならないよう、静止状態を明示しておく。
	 */
	@media (prefers-reduced-motion: reduce) {
		.figure,
		.face,
		.halo {
			animation: none;
		}
	}
</style>
