<!--
	面 1(ビジュアル特化の面)のプレースホルダ。
	本実装(スタイリッシュで見続けたくなるビジュアル)は #3 で置き換える。
-->
<svelte:head>
	<title>Showcase | atf-demo-web</title>
</svelte:head>

<section class="showcase" data-face="visual">
	<h1>Showcase</h1>
	<p>ポートフォリオをビジュアルで感じる面(準備中)</p>
</section>

<style>
	.showcase {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4);
		text-align: center;
	}

	h1 {
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
	}

	p {
		color: var(--color-fg-muted);
	}
</style>
