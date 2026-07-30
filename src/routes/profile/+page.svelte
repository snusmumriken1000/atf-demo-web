<!--
	面 2(情報整理の面)のプレースホルダ。
	本実装(経歴・スキル・作品詳細のコンテンツ)は #4 で置き換える。
-->
<svelte:head>
	<title>Profile | atf-demo-web</title>
</svelte:head>

<article class="profile" data-face="profile">
	<h1>Profile</h1>
	<p>経歴・スキル・作品を落ち着いて読める面です。</p>

	<section>
		<h2>経歴</h2>
		<p>準備中です。</p>
	</section>

	<section>
		<h2>スキル</h2>
		<p>準備中です。</p>
	</section>

	<section>
		<h2>作品</h2>
		<p>準備中です。</p>
	</section>
</article>

<style>
	.profile {
		max-width: 40rem;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
	}

	h1 {
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
	}

	h1 + p {
		margin-top: var(--space-2);
		color: var(--color-fg-muted);
	}

	section {
		margin-top: var(--space-8);
	}

	h2 {
		font-size: var(--text-lg);
		line-height: var(--leading-tight);
	}

	section p {
		margin-top: var(--space-2);
	}
</style>
