<!--
	面 2(情報整理の面)。自己紹介・経歴・スキル・作品詳細を読みやすい順に並べる。
	表示文言は src/lib/data/content.ts が単一ソース。
-->
<script lang="ts">
	import { content } from '$lib/data/content';

	const { site, hero, profile, works } = content;
</script>

<svelte:head>
	<title>{site.faces.profile.label} | {site.title}</title>
	<meta name="description" content={site.faces.profile.lead} />
</svelte:head>

<article class="profile" data-face="profile">
	<header class="profile-header">
		<p class="eyebrow">{site.faces.profile.label}</p>
		<h1>{hero.name}</h1>
		<p class="statement">{hero.statement.replace('\n', ' ')}</p>
	</header>

	<div class="content">
		<section class="about" aria-labelledby="about-heading">
			<h2 id="about-heading">{profile.sectionLabels.about}</h2>
			<div class="prose">
				{#each profile.intro ?? [] as paragraph (paragraph)}
					<p>{paragraph}</p>
				{/each}
			</div>

			{#if profile.links?.length}
				<nav class="profile-links" aria-label={profile.sectionLabels.links}>
					{#each profile.links as link (link.url)}
						<!-- 外部 URL は resolve の対象外 -->
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={link.url} rel="me">{link.label}<span aria-hidden="true"> ↗</span></a>
					{/each}
				</nav>
			{/if}
		</section>

		<section aria-labelledby="career-heading">
			<h2 id="career-heading">{profile.sectionLabels.career}</h2>
			<ol class="career-list">
				{#each profile.career as entry (`${entry.period}-${entry.title}`)}
					<li>
						<p class="period">{entry.period}</p>
						<div>
							<h3>{entry.title}</h3>
							{#if entry.org}<p class="org">{entry.org}</p>{/if}
							{#if entry.summary}<p class="summary">{entry.summary}</p>{/if}
						</div>
					</li>
				{/each}
			</ol>
		</section>

		<section aria-labelledby="skills-heading">
			<h2 id="skills-heading">{profile.sectionLabels.skills}</h2>
			<div class="skill-groups">
				{#each profile.skills as group, index (group.label)}
					{@const headingId = `skill-group-${index + 1}`}
					<section class="skill-group" aria-labelledby={headingId}>
						<h3 id={headingId}>{group.label}</h3>
						<ul>
							{#each group.items as skill (skill.name)}
								<li>
									<span>{skill.name}</span>
									{#if skill.note}<small>{skill.note}</small>{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</section>

		<section aria-labelledby="works-heading">
			<h2 id="works-heading">{profile.sectionLabels.works}</h2>
			<div class="work-list">
				{#each works as work, index (work.id)}
					<article class="work" id={'work-' + work.id}>
						<p class="work-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</p>
						<div class="work-body">
							<header>
								<h3>{work.title}</h3>
								<p class="blurb">{work.blurb}</p>
							</header>

							{#if work.role || work.period || work.tech?.length}
								<dl>
									{#if work.role}
										<div>
											<dt>{profile.workMetaLabels.role}</dt>
											<dd>{work.role}</dd>
										</div>
									{/if}
									{#if work.period}
										<div>
											<dt>{profile.workMetaLabels.period}</dt>
											<dd>{work.period}</dd>
										</div>
									{/if}
									{#if work.tech?.length}
										<div>
											<dt>{profile.workMetaLabels.tech}</dt>
											<dd>{work.tech.join(' / ')}</dd>
										</div>
									{/if}
								</dl>
							{/if}

							{#if work.description?.length}
								<div class="prose">
									{#each work.description as paragraph (paragraph)}<p>{paragraph}</p>{/each}
								</div>
							{/if}

							{#if work.links?.length}
								<nav class="work-links" aria-label={`${work.title} ${profile.sectionLabels.links}`}>
									{#each work.links as link (link.url)}
										<!-- 外部 URL は resolve の対象外 -->
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href={link.url}>{link.label}<span aria-hidden="true"> ↗</span></a>
									{/each}
								</nav>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		</section>
	</div>
</article>

<style>
	.profile {
		width: min(100%, 72rem);
		margin: 0 auto;
		padding: clamp(5rem, 10vw, 8rem) var(--space-4) var(--space-8);
	}

	.profile-header {
		padding-bottom: clamp(3rem, 8vw, 6rem);
		border-bottom: 1px solid color-mix(in srgb, var(--color-fg-muted) 25%, transparent);
	}

	.eyebrow,
	.period,
	.work-number,
	dt {
		color: var(--color-fg-muted);
		font-size: var(--text-sm);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1 {
		margin-top: var(--space-3);
		font-size: clamp(var(--text-3xl), 8vw, 5.5rem);
		line-height: 1;
		letter-spacing: -0.04em;
	}

	.statement {
		margin-top: var(--space-5);
		max-width: 32rem;
		color: var(--color-fg-muted);
		font-size: var(--text-lg);
	}

	.content > section {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) minmax(0, 3fr);
		gap: var(--space-8);
		padding: clamp(3rem, 7vw, 5rem) 0;
		border-bottom: 1px solid color-mix(in srgb, var(--color-fg-muted) 25%, transparent);
		scroll-margin-top: 5rem;
	}

	h2 {
		font-size: var(--text-lg);
		line-height: var(--leading-tight);
	}

	h3 {
		font-size: var(--text-xl);
		line-height: var(--leading-tight);
	}

	.prose {
		max-width: 44rem;
	}

	.prose p + p {
		margin-top: var(--space-3);
	}

	.profile-links,
	.work-links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		margin-top: var(--space-5);
	}

	a {
		color: var(--color-accent);
		text-underline-offset: var(--space-1);
	}

	a:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}

	.career-list,
	.skill-group ul {
		padding: 0;
		list-style: none;
	}

	.career-list li {
		display: grid;
		grid-template-columns: minmax(7rem, 1fr) 2fr;
		gap: var(--space-5);
	}

	.career-list li + li {
		margin-top: var(--space-8);
	}

	.org {
		margin-top: var(--space-1);
		color: var(--color-fg-muted);
	}

	.summary {
		margin-top: var(--space-3);
		max-width: 36rem;
	}

	.skill-groups {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-6);
	}

	.skill-group {
		padding: var(--space-5);
		background: var(--color-surface);
		border-radius: var(--space-2);
	}

	.skill-group h3 {
		font-size: var(--text-base);
	}

	.skill-group ul {
		margin-top: var(--space-4);
	}

	.skill-group li + li {
		margin-top: var(--space-3);
	}

	.skill-group small {
		display: block;
		color: var(--color-fg-muted);
		font-size: var(--text-sm);
	}

	.work {
		display: grid;
		grid-template-columns: 3rem minmax(0, 1fr);
		gap: var(--space-4);
		scroll-margin-top: 5rem;
	}

	.work + .work {
		margin-top: clamp(3rem, 7vw, 5rem);
		padding-top: clamp(3rem, 7vw, 5rem);
		border-top: 1px solid color-mix(in srgb, var(--color-fg-muted) 25%, transparent);
	}

	.blurb {
		margin-top: var(--space-2);
		color: var(--color-fg-muted);
	}

	dl {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4) var(--space-8);
		margin: var(--space-5) 0;
		padding: var(--space-4) 0;
		border-block: 1px solid color-mix(in srgb, var(--color-fg-muted) 20%, transparent);
	}

	dl div {
		min-width: 6rem;
	}

	dd {
		margin: var(--space-1) 0 0;
	}

	@media (max-width: 44rem) {
		.content > section {
			grid-template-columns: 1fr;
			gap: var(--space-5);
		}

		.career-list li {
			grid-template-columns: 1fr;
			gap: var(--space-2);
		}

		.skill-groups {
			grid-template-columns: 1fr;
		}

		.work {
			grid-template-columns: 2rem minmax(0, 1fr);
		}
	}
</style>
