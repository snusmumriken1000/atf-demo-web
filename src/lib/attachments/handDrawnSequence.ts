import type { Attachment } from 'svelte/attachments';
import { CARD_OVERLAP_MS, resolveDrawingSchedule } from '$lib/motion/drawingSchedule';

const SESSION_KEY = 'atf:showcase-hand-drawn:v1';
const memorySessions = new Set<string>();

function hasPlayed(): boolean {
	try {
		return sessionStorage.getItem(SESSION_KEY) === '1';
	} catch {
		return memorySessions.has(SESSION_KEY);
	}
}

function markPlayed(): void {
	memorySessions.add(SESSION_KEY);
	try {
		sessionStorage.setItem(SESSION_KEY, '1');
	} catch {
		/* privacy mode: memory fallback */
	}
}

function finish(root: HTMLElement, hand: HTMLElement | null, state: 'complete' | 'skipped') {
	root.dataset.drawingState = state;
	root
		.querySelectorAll<HTMLElement>('[data-draw-step]')
		.forEach((step) => step.classList.add('drawn'));
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

		const stop = (state: 'complete' | 'skipped') => {
			cancelled = true;
			animations.splice(0).forEach((animation) => animation.revert());
			worksObserver?.disconnect();
			resolveWorks?.();
			finish(root, hand, state);
		};

		const onMotionChange = (event: MediaQueryListEvent) => {
			if (event.matches) stop('skipped');
		};
		media.addEventListener?.('change', onMotionChange);

		if (media.matches || hasPlayed()) {
			finish(root, hand, 'skipped');
			return () => media.removeEventListener?.('change', onMotionChange);
		}

		root.dataset.drawingState = 'active';
		markPlayed();

		const positions = new Map<HTMLElement, { x: number; y: number }>();
		const measure = () =>
			root.querySelectorAll<HTMLElement>('[data-draw-step]').forEach((step) => {
				const rect = step.getBoundingClientRect();
				positions.set(step, { x: rect.right - 8, y: rect.bottom - 8 });
			});
		const updateHandVisibility = () => {
			if (!hand || !currentStep) return;
			const rect = currentStep.getBoundingClientRect();
			hand.style.opacity = rect.bottom < 0 || rect.top > innerHeight ? '0' : '1';
		};
		measure();
		window.addEventListener('scroll', updateHandVisibility, { passive: true });
		if ('ResizeObserver' in window) {
			resizeObserver = new ResizeObserver(measure);
			resizeObserver.observe(root);
		}

		void (async () => {
			const { animate } = await import('animejs');
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
				const position = positions.get(step) ?? { x: 0, y: 0 };
				if (hand) {
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
				if (path)
					animations.push(animate(path, { strokeDashoffset: [1, 0], duration, ease: 'linear' }));
				const animation = animate(step, {
					opacity: [0, 1],
					duration,
					ease: 'outQuad',
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
					Math.max(0, phase.duration - (phase.id.startsWith('work-') ? CARD_OVERLAP_MS : 0))
				);
			}
			if (!cancelled) finish(root, hand, 'complete');
		})().catch(() => finish(root, hand, 'skipped'));

		return () => {
			stop('skipped');
			resizeObserver?.disconnect();
			window.removeEventListener('scroll', updateHandVisibility);
			media.removeEventListener?.('change', onMotionChange);
			delete root.dataset.drawingState;
		};
	};
}
