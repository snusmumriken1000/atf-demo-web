<!--
	会話ログの 1 発言。ボットの発言には、回答の根拠になった知識と
	その内容がある場所へのリンクを添える。

	リンクの解決(resolve)はここで行う。knowledge.ts は route と hash しか持たず、
	paths.base を意識しないで済むようにしてある。
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { KnowledgeEntry, KnowledgeLink } from '$lib/bot/knowledge';
	import { content } from '$lib/data/content';

	type Props = {
		role: 'bot' | 'user';
		text: string;
		/** ボットの回答の根拠(ユーザー発言では空) */
		entries?: KnowledgeEntry[];
	};

	const { role, text, entries = [] }: Props = $props();
	const { ask } = content;

	/** サイト内リンクを実際の href に直す。route は面のルート id */
	function hrefFor(link: KnowledgeLink): string {
		if (link.type === 'external') return link.url;
		const base = link.route === '/showcase' ? resolve('/showcase') : resolve('/profile');
		return link.hash ? `${base}#${link.hash}` : base;
	}
</script>

<li class="message" data-role={role}>
	<p class="speaker">{role === 'bot' ? ask.botName : ask.userName}</p>
	<div class="bubble">
		<p class="text">{text}</p>

		{#each entries as entry (entry.id)}
			<article class="entry">
				<h3>{entry.title}</h3>
				{#each entry.body as paragraph (paragraph)}
					<p>{paragraph}</p>
				{/each}
				{#if entry.meta.length > 0}
					<p class="meta">{entry.meta.join(' ・ ')}</p>
				{/if}
				{#if entry.links.length > 0}
					<p class="links">
						<span class="links-label">{ask.sourceLabel}:</span>
						{#each entry.links as link (link.label + hrefFor(link))}
							{#if link.type === 'external'}
								<!-- 外部 URL は resolve の対象外 -->
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={link.url} rel="noreferrer"
									>{link.label}<span aria-hidden="true"> ↗</span></a
								>
							{:else}
								<!-- hrefFor が resolve() を通しているため、この行では解決済み -->
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={hrefFor(link)}>{link.label}</a>
							{/if}
						{/each}
					</p>
				{/if}
			</article>
		{/each}
	</div>
</li>

<style>
	.message {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		max-width: 44rem;
	}

	/* 自分の発言は右寄せにして、話者の交代を形でも分かるようにする */
	.message[data-role='user'] {
		align-self: flex-end;
		align-items: flex-end;
	}

	.speaker {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-fg-muted);
	}

	.bubble {
		padding: var(--space-4);
		border: 1px solid color-mix(in srgb, var(--color-fg-muted) 35%, transparent);
		border-radius: var(--space-3);
		background: var(--color-surface);
	}

	.message[data-role='user'] .bubble {
		background: transparent;
	}

	.text {
		white-space: pre-wrap;
	}

	.entry {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid color-mix(in srgb, var(--color-fg-muted) 25%, transparent);
	}

	.entry h3 {
		font-size: var(--text-base);
		line-height: var(--leading-tight);
	}

	.entry p {
		margin-top: var(--space-2);
		line-height: var(--leading-relaxed);
	}

	.meta,
	.links {
		font-size: var(--text-sm);
		color: var(--color-fg-muted);
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.links a {
		color: var(--color-accent);
	}

	.links a:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
