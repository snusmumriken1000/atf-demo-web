export type DrawingPhase = {
	id: string;
	durationToken: string;
	fallbackDuration: number;
	group: 'hero' | 'works';
};

export type DrawingSequenceState = 'idle' | 'drawing' | 'complete' | 'skipped';

export const DRAWING_PHASES: readonly DrawingPhase[] = [
	{ id: 'eyebrow', durationToken: '--motion-draw-short', fallbackDuration: 400, group: 'hero' },
	{ id: 'statement-1', durationToken: '--motion-draw-long', fallbackDuration: 850, group: 'hero' },
	{ id: 'statement-2', durationToken: '--motion-draw-long', fallbackDuration: 850, group: 'hero' },
	{ id: 'lead', durationToken: '--motion-draw-medium', fallbackDuration: 750, group: 'hero' },
	{ id: 'hint', durationToken: '--motion-draw-short', fallbackDuration: 350, group: 'hero' },
	{
		id: 'works-heading',
		durationToken: '--motion-draw-short',
		fallbackDuration: 450,
		group: 'works'
	},
	{ id: 'work-1', durationToken: '--motion-draw-card', fallbackDuration: 650, group: 'works' },
	{ id: 'work-2', durationToken: '--motion-draw-card', fallbackDuration: 650, group: 'works' },
	{ id: 'work-3', durationToken: '--motion-draw-card', fallbackDuration: 650, group: 'works' },
	{ id: 'work-4', durationToken: '--motion-draw-card', fallbackDuration: 650, group: 'works' }
] as const;

export const HAND_ENTRANCE_MS = 350;
export const HAND_EXIT_MS = 250;
export const CARD_OVERLAP_MS = 120;

export function parseMotionTime(value: string, fallback: number): number {
	const trimmed = value.trim();
	if (/^-?[\d.]+ms$/.test(trimmed)) return Math.max(0, Number.parseFloat(trimmed));
	if (/^-?[\d.]+s$/.test(trimmed)) return Math.max(0, Number.parseFloat(trimmed) * 1000);
	return fallback;
}

export function resolveDrawingSchedule(styles: Pick<CSSStyleDeclaration, 'getPropertyValue'>) {
	return DRAWING_PHASES.map((phase) => ({
		...phase,
		duration: parseMotionTime(styles.getPropertyValue(phase.durationToken), phase.fallbackDuration)
	}));
}

export function drawingDuration(phases = DRAWING_PHASES): number {
	const phaseDuration = phases.reduce((sum, phase) => sum + phase.fallbackDuration, 0);
	return HAND_ENTRANCE_MS + phaseDuration - CARD_OVERLAP_MS * 3 + HAND_EXIT_MS;
}
