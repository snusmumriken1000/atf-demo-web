<script lang="ts">
	let { kind = 'underline' }: { kind?: 'underline' | 'outline' } = $props();
</script>

<svg
	class:outlining={kind === 'outline'}
	class="sketch-stroke"
	viewBox={kind === 'outline' ? '0 0 100 100' : '0 0 100 8'}
	preserveAspectRatio="none"
	aria-hidden="true"
>
	{#if kind === 'outline'}
		<path data-draw-path pathLength="1" d="M3 5 C25 2 75 4 97 3 L98 96 C72 99 27 96 3 98 Z" />
	{:else}
		<path data-draw-path pathLength="1" d="M1 5 C18 1, 34 7, 52 4 S82 2, 99 5" />
	{/if}
</svg>

<style>
	.sketch-stroke {
		position: absolute;
		left: 0;
		bottom: -0.35rem;
		width: 100%;
		height: 0.45rem;
		pointer-events: none;
		overflow: visible;
	}

	.outlining {
		inset: -0.5rem;
		width: calc(100% + 1rem);
		height: calc(100% + 1rem);
	}

	path {
		fill: none;
		stroke: var(--color-accent);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-dasharray: 1;
		stroke-dashoffset: 0;
		vector-effect: non-scaling-stroke;
	}
</style>
