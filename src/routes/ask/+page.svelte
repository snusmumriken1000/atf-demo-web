<!--
	面 3(対話の面)。このサイトの内容について質問できる。

	話し相手は AskCompanion(丸くて白い生き物)。答えるたびに一度だけ反応する。
	ボットは外部 AI を使わず、content.ts を検索して答える(src/lib/bot/)。
	答えの中身は経歴・スキル・作品からそのまま引かれるので、content.ts を
	書き換えれば回答も変わる。書かれていないことは「答えられない」と返す。

	アクセシビリティ:
	- 会話ログは role="log" + aria-live="polite" で新着だけを読み上げる
	- 送信はフォーム(Enter でも送信ボタンでも同じ経路)
	- 質問例はボタンなので、キーボードだけで会話を始められる
-->
<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import AskCompanion from '$lib/components/AskCompanion.svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import { createBot, type Answer } from '$lib/bot/answer';
	import type { KnowledgeEntry } from '$lib/bot/knowledge';
	import { content } from '$lib/data/content';

	const { site, ask } = content;
	// 索引は 1 度だけ組む(以降の検索は同期処理で、通信は一切しない)
	const bot = createBot(content);

	type Message = {
		id: number;
		role: 'bot' | 'user';
		text: string;
		entries: KnowledgeEntry[];
	};

	/** 反応の長さ(ms)。global.css の --motion-duration-fade と揃える */
	const REACTION_MS = 400;

	let nextId = 0;
	const message = (
		role: 'bot' | 'user',
		text: string,
		entries: KnowledgeEntry[] = []
	): Message => ({
		id: nextId++,
		role,
		text,
		entries
	});

	let messages = $state<Message[]>([message('bot', ask.greeting)]);
	let draft = $state('');
	let log = $state<HTMLElement | null>(null);
	/** 直近の回答で提示する質問例(答えられなかったときなどに出す) */
	let suggestions = $state<string[]>(ask.suggestions);
	/** 生き物の様子。答えた直後だけ 'talking' にする */
	let companionState = $state<'idle' | 'talking'>('idle');
	let reactionTimer: ReturnType<typeof setTimeout> | null = null;

	/** 答えるたびに一度だけ反応させる(アニメーションを鳴らし直すため一旦 idle に戻す) */
	function react() {
		if (reactionTimer !== null) clearTimeout(reactionTimer);
		companionState = 'idle';
		requestAnimationFrame(() => {
			companionState = 'talking';
			reactionTimer = setTimeout(() => {
				companionState = 'idle';
				reactionTimer = null;
			}, REACTION_MS);
		});
	}

	onDestroy(() => {
		if (reactionTimer !== null) clearTimeout(reactionTimer);
	});

	function appendAnswer(answer: Answer) {
		messages = [...messages, message('bot', answer.lead, answer.entries)];
		react();
		// 答えられなかった / 案内のときだけ質問例を出し直す
		suggestions = answer.suggestions.length > 0 ? answer.suggestions : [];
	}

	async function send(question: string) {
		const trimmed = question.trim();
		if (trimmed.length === 0) return;

		messages = [...messages, message('user', trimmed)];
		draft = '';
		appendAnswer(bot.ask(trimmed));

		// 追加された発言まで送る(ログ自体をスクロールさせ、ページは動かさない)
		await tick();
		if (log) log.scrollTop = log.scrollHeight;
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void send(draft);
	}
</script>

<svelte:head>
	<title>{site.faces.ask.label} | {site.title}</title>
	<meta name="description" content={site.faces.ask.lead} />
</svelte:head>

<section class="ask" data-face="dialogue">
	<header class="ask-header">
		<AskCompanion state={companionState} name={ask.botName} description={ask.companionAlt} />
		<div>
			<p class="eyebrow">{site.faces.ask.label}</p>
			<h1>{site.faces.ask.lead}</h1>
			<p class="notice">{ask.notice}</p>
		</div>
	</header>

	<!-- 新着の発言だけを読み上げる。過去ログは読み直さない -->
	<ol class="log" bind:this={log} role="log" aria-live="polite" aria-label={site.faces.ask.label}>
		{#each messages as item (item.id)}
			<ChatMessage role={item.role} text={item.text} entries={item.entries} />
		{/each}
	</ol>

	<div class="composer">
		{#if suggestions.length > 0}
			<ul class="suggestions">
				{#each suggestions as suggestion (suggestion)}
					<li>
						<button type="button" onclick={() => send(suggestion)}>{suggestion}</button>
					</li>
				{/each}
			</ul>
		{/if}

		<form onsubmit={handleSubmit}>
			<label class="sr-only" for="ask-input">{ask.inputLabel}</label>
			<input
				id="ask-input"
				type="text"
				autocomplete="off"
				placeholder={ask.placeholder}
				bind:value={draft}
			/>
			<button type="submit" disabled={draft.trim().length === 0}>{ask.sendLabel}</button>
		</form>
	</div>
</section>

<style>
	/*
	 * 画面の高さに収め、伸びるのは会話ログだけにする。
	 * height(min-height ではない)にしないと、ログが伸びた分だけ
	 * ページ全体が縦に伸びて入力欄が画面外へ出てしまう。
	 */
	.ask {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		height: 100dvh;
		max-width: 52rem;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4);
	}

	.ask-header {
		display: flex;
		align-items: center;
		gap: var(--space-5);
		/* 面の切り替えボタンと重ならないよう右に余白を取る */
		padding-right: calc(var(--space-8) * 2);
	}

	@media (max-width: 40rem) {
		.ask-header {
			gap: var(--space-4);
		}
	}

	.eyebrow {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-fg-muted);
	}

	h1 {
		margin-top: var(--space-2);
		font-size: var(--text-xl);
		line-height: var(--leading-tight);
		letter-spacing: -0.01em;
	}

	.notice {
		margin-top: var(--space-3);
		font-size: var(--text-sm);
		line-height: var(--leading-relaxed);
		color: var(--color-fg-muted);
	}

	/* 会話ログだけがスクロールする。入力欄は常に見えている */
	.log {
		flex: 1;
		/* flex の子は既定で内容より小さくならない。0 にしないとログが縮まずスクロールしない */
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		overflow-y: auto;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/*
	 * 発言を下(入力欄のすぐ上)から積む。会話が短いうちに上半分が
	 * 空くのを防ぐ。justify-content: flex-end だとスクロール時に
	 * 上が切れる環境があるため、先頭要素の margin で寄せる。
	 */
	.log > :global(li:first-child) {
		margin-top: auto;
	}

	.composer {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		list-style: none;
		padding: 0;
	}

	.suggestions button {
		padding: var(--space-1) var(--space-3);
		border: 1px solid color-mix(in srgb, var(--color-fg-muted) 45%, transparent);
		border-radius: 999px;
		background: transparent;
		color: var(--color-fg-muted);
		font-family: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		transition:
			border-color var(--motion-duration) var(--motion-ease),
			color var(--motion-duration) var(--motion-ease);
	}

	.suggestions button:hover {
		border-color: var(--color-accent);
		color: var(--color-fg);
	}

	form {
		display: flex;
		gap: var(--space-2);
	}

	input {
		flex: 1;
		padding: var(--space-3) var(--space-4);
		border: 1px solid color-mix(in srgb, var(--color-fg-muted) 45%, transparent);
		border-radius: var(--space-2);
		background: var(--color-surface);
		color: var(--color-fg);
		font-family: inherit;
		font-size: var(--text-base);
	}

	input::placeholder {
		color: var(--color-fg-muted);
	}

	form button {
		padding: var(--space-3) var(--space-5);
		border: 1px solid var(--color-accent);
		border-radius: var(--space-2);
		background: var(--color-accent);
		color: var(--color-bg);
		font-family: inherit;
		font-size: var(--text-base);
		cursor: pointer;
		transition: opacity var(--motion-duration) var(--motion-ease);
	}

	form button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	:global(.ask) button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 40rem) {
		form {
			flex-wrap: wrap;
		}

		form button {
			width: 100%;
		}
	}
</style>
