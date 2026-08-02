<div class="drawing-hand" data-drawing-hand data-drawing-tool="technical-pen" aria-hidden="true">
	<svg viewBox="0 0 112 88" role="presentation">
		<!-- The nib stays at (11, 84); handDrawnSequence uses that point as its drawing anchor. -->
		<path class="pen-body" d="M14.5 79.8 78.1 16.2l4.1 4.1-63.6 63.6" />
		<path class="pen-detail" d="m72.8 21.5 4.1 4.1M78.1 16.2l3.4-3.4 7.2 7.2-3.4 3.4" />
		<path class="nib" d="m11 84 3.5-4.2 4.1 4.1L11 84Z" />
		<path
			class="hand-outline"
			d="M80.7 24.7c5.3 1.1 9.9 4.2 12.8 8.7l8.8 13.8c2.2 3.5 1.4 8.1-1.9 10.6L83.2 70.9c-4 3-9.1 4.1-14 2.9l-17.5-4.2c-3.8-.9-6.1-4.8-5-8.5.9-3 3.6-5 6.7-5l12 .2 7.8-7.8"
		/>
		<path class="finger-line" d="m65.4 56.3 10.4-10.4c2.3-2.3 2.3-6 0-8.3" />
		<path class="finger-line" d="m72.1 50.1 9.4-9.4c2.2-2.2 5.8-2.2 8 0" />
		<path class="finger-line" d="m78.1 55.6 7.8-7.8c2.2-2.2 5.8-2.2 8 0" />
		<path class="grip-line" d="M56.2 56.2c3.3.1 6.5 1.5 8.8 3.8" />
	</svg>
</div>

<style>
	.drawing-hand {
		position: fixed;
		z-index: calc(var(--z-nav) - 1);
		top: 0;
		left: 0;
		width: 6.25rem;
		color: #737986;
		pointer-events: none;
		opacity: 0;
		filter: drop-shadow(0 0.2rem 0.35rem rgb(0 0 0 / 0.16));
		transform: translate3d(var(--hand-x, -8rem), var(--hand-y, -8rem), 0);
		transform-origin: 11px 84px;
		will-change: transform, opacity;
	}

	svg {
		display: block;
		width: 100%;
		overflow: visible;
	}

	.pen-body,
	.pen-detail,
	.nib,
	.hand-outline,
	.finger-line,
	.grip-line {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.15;
		stroke-linecap: round;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.pen-body,
	.nib {
		stroke: #a3a9b3;
	}

	.pen-detail,
	.finger-line,
	.grip-line {
		stroke: #858b96;
	}

	@media (max-width: 40rem) {
		.drawing-hand {
			width: 4.75rem;
			filter: drop-shadow(0 0.15rem 0.25rem rgb(0 0 0 / 0.14));
		}
	}
</style>
