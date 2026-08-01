<div class="drawing-hand" data-drawing-hand aria-hidden="true">
	<svg viewBox="0 0 112 88" role="presentation">
		<path
			class="hand"
			d="M25 47c9-12 19-21 29-25 7-3 14 2 12 9l-3 10 8-7c5-4 12 0 10 7l-2 6 5-3c6-3 12 3 8 9L77 73c-5 7-14 10-23 7L34 69c-9-5-14-13-9-22Z"
		/>
		<path class="pen" d="m15 70 60-53 9 10-60 53-13 4Z" />
		<path class="pen-tip" d="m11 84 4-14 9 10Z" />
	</svg>
</div>

<style>
	.drawing-hand {
		position: fixed;
		z-index: calc(var(--z-nav) - 1);
		top: 0;
		left: 0;
		width: 7rem;
		pointer-events: none;
		opacity: 0;
		transform: translate3d(var(--hand-x, -8rem), var(--hand-y, -8rem), 0);
		transform-origin: 11px 84px;
		will-change: transform, opacity;
	}

	svg {
		display: block;
		width: 100%;
		overflow: visible;
	}
	.hand {
		fill: #d6a47a;
		stroke: #301f22;
		stroke-width: 2;
	}
	.pen {
		fill: var(--color-accent);
		stroke: #0b0f1a;
		stroke-width: 2;
	}
	.pen-tip {
		fill: #e8eaf0;
		stroke: #0b0f1a;
		stroke-width: 2;
	}

	@media (max-width: 40rem) {
		.drawing-hand {
			width: 5rem;
		}
	}
</style>
