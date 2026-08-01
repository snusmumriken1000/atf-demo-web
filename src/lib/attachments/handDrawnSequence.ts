import type { Attachment } from 'svelte/attachments';
import { CARD_DRAW_REDUCTION_MS, resolveDrawingSchedule } from '$lib/motion/drawingSchedule';

const SESSION_KEY = 'atf:showcase-hand-drawn:v1';
const WINDOW_NAME_MARKER = `__${SESSION_KEY}__`;
const memorySessions = new Set<string>();

const PEN_TIP_X_RATIO = 11 / 112;
const PEN_TIP_Y_RATIO = 84 / 88;

export function resolveHandPosition(
	stepRect: Pick<DOMRect, 'left' | 'right' | 'bottom'>,
	handRect: Pick<DOMRect, 'width' | 'height'>
): { startX: number; x: number; y: number } {
	const startX = stepRect.left + 8;
	const targetX = stepRect.right - 8;
	const targetY = stepRect.bottom - 8;
	return {
		startX: startX - handRect.width * PEN_TIP_X_RATIO,
		x: targetX - handRect.width * PEN_TIP_X_RATIO,
		y: targetY - handRect.height * PEN_TIP_Y_RATIO
	};
}

function hasPlayed(): boolean {
	try {
		return sessionStorage.getItem(SESSION_KEY) === '1';
	} catch {
		return memorySessions.has(SESSION_KEY) || window.name.includes(WINDOW_NAME_MARKER);
	}
}

function markPlayed(): void {
	memorySessions.add(SESSION_KEY);
	try {
		sessionStorage.setItem(SESSION_KEY, '1');
	} catch {
		/* privacy mode: module memory + same-tab reload fallback */
		if (!window.name.includes(WINDOW_NAME_MARKER)) window.name += WINDOW_NAME_MARKER;
	}
}

function finish(root: HTMLElement, hand: HTMLElement | null, state: 'complete' | 'skipped') {
	root.dataset.drawingState = state;
	root.querySelectorAll<HTMLElement>('[data-draw-step]').forEach((step) => {
		step.classList.add('drawn');
		step.inert = false;
	});
	if (hand) hand.style.opacity = '0';
}

export function handDrawnSequence(): Attachment<HTMLElement> {
	return (root) => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const hand = root.querySelector<HTMLElement>('[data-drawing-hand]');
		let cancelled = false;
		const animations: { revert(): unknown }[] = [];
		let currentStep: HTMLElement | undefined;
		let worksObserver: IntersectionObserver | undefined;
		let resizeObserver: ResizeObserver | undefined;
		let resolveWorks: (() => void) | undefined;
		let monitoring = false;

		const stopMonitoring = () => {
			if (!monitoring) return;
			monitoring = false;
			worksObserver?.disconnect();
			resizeObserver?.disconnect();
			window.removeEventListener('scroll', updateHandVisibility);
			media.removeEventListener?.('change', onMotionChange);
		};

		const stop = (state: 'complete' | 'skipped') => {
			cancelled = true;
			animations.splice(0).forEach((animation) => animation.revert());
			resolveWorks?.();
			stopMonitoring();
			finish(root, hand, state);
		};

		const onMotionChange = (event: MediaQueryListEvent) => {
			if (event.matches) stop('skipped');
		};
		media.addEventListener?.('change', onMotionChange);

		if (media.matches || hasPlayed()) {
			finish(root, hand, 'skipped');
			return () => {
				media.removeEventListener?.('change', onMotionChange);
				finish(root, hand, 'skipped');
				delete root.dataset.drawingState;
			};
		}

		root.dataset.drawingState = 'active';
		markPlayed();
		root.querySelectorAll<HTMLElement>('[data-draw-step]').forEach((step) => (step.inert = true));

		const positions = new Map<HTMLElement, { startX: number; x: number; y: number }>();
		const measure = () => {
			const handRect = hand?.getBoundingClientRect() ?? ({ width: 0, height: 0 } as DOMRect);
			root.querySelectorAll<HTMLElement>('[data-draw-step]').forEach((step) => {
				const rect = step.getBoundingClientRect();
				positions.set(step, resolveHandPosition(rect, handRect));
			});
		};
		const updateHandVisibility = () => {
			if (!hand || !currentStep) return;
			const rect = currentStep.getBoundingClientRect();
			hand.style.opacity = rect.bottom < 0 || rect.top > innerHeight ? '0' : '1';
		};
		measure();
		monitoring = true;
		window.addEventListener('scroll', updateHandVisibility, { passive: true });
		if ('ResizeObserver' in window) {
			resizeObserver = new ResizeObserver(measure);
			resizeObserver.observe(root);
		}

		void (async () => {
			const { animate } = await import('animejs/animation');
			if (cancelled) return;
			const schedule = resolveDrawingSchedule(getComputedStyle(root));
			const steps = new Map(
				Array.from(root.querySelectorAll<HTMLElement>('[data-draw-step]')).map((step) => [
					step.dataset.drawStep,
					step
				])
			);

			const draw = async (id: string, duration: number) => {
				const step = steps.get(id);
				if (!step || cancelled) return;
				currentStep = step;
				// Works は IntersectionObserver の待機中にスクロールされるため、
				// キャッシュ値ではなく描画直前の viewport 座標を必ず使う。
				const position = resolveHandPosition(
					step.getBoundingClientRect(),
					hand?.getBoundingClientRect() ?? ({ width: 0, height: 0 } as DOMRect)
				);
				positions.set(step, position);
				if (hand) {
					hand.style.setProperty('--hand-x', `${position.startX}px`);
					hand.style.setProperty('--hand-y', `${position.y}px`);
					updateHandVisibility();
					animations.push(
						animate(hand, {
							'--hand-x': `${position.x}px`,
							'--hand-y': `${position.y}px`,
							duration,
							ease: 'inOutQuad'
						})
					);
				}
				const path = step.querySelector<SVGPathElement>('[data-draw-path]');
				const isCard = step.dataset.drawKind === 'card';
				const strokeDuration = isCard ? duration * 0.6 : duration;
				const strokeAnimation = path
					? animate(path, { strokeDashoffset: [1, 0], duration: strokeDuration, ease: 'linear' })
					: undefined;
				if (strokeAnimation) animations.push(strokeAnimation);
				// カードだけは輪郭を描き切ってから内容を見せる。
				if (isCard && strokeAnimation) await strokeAnimation.then();
				if (cancelled) return;
				step.inert = false;
				const revealTarget = isCard
					? (step.querySelector<HTMLElement>('[data-draw-content]') ?? step)
					: step;
				const animation = animate(revealTarget, {
					opacity: isCard ? [0, 1] : 1,
					clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'],
					duration: isCard ? duration * 0.4 : duration,
					ease: isCard ? 'outQuad' : 'linear',
					onComplete: () => step.classList.add('drawn')
				});
				animations.push(animation);
				await animation.then();
			};

			for (const phase of schedule.filter((item) => item.group === 'hero'))
				await draw(phase.id, phase.duration);
			if (cancelled) return;

			const works = root.querySelector<HTMLElement>('.works');
			if (hand) hand.style.opacity = '0';
			if (works && !works.getBoundingClientRect().top.toString().includes('NaN')) {
				await new Promise<void>((resolve) => {
					resolveWorks = resolve;
					worksObserver = new IntersectionObserver(
						(entries) => {
							if (entries.some((entry) => entry.isIntersecting)) {
								worksObserver?.disconnect();
								resolve();
							}
						},
						{ threshold: 0.08 }
					);
					worksObserver.observe(works);
				});
			}
			for (const phase of schedule.filter((item) => item.group === 'works')) {
				await draw(
					phase.id,
					Math.max(0, phase.duration - (phase.id.startsWith('work-') ? CARD_DRAW_REDUCTION_MS : 0))
				);
			}
			if (!cancelled) {
				stopMonitoring();
				finish(root, hand, 'complete');
			}
		})().catch(() => stop('skipped'));

		return () => {
			stop('skipped');
			delete root.dataset.drawingState;
		};
	};
}
