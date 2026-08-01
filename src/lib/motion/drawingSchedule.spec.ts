import { describe, expect, it } from 'vitest';
import {
	DRAWING_PHASES,
	drawingDuration,
	parseMotionTime,
	resolveDrawingSchedule
} from './drawingSchedule';

describe('drawingSchedule', () => {
	it('全工程を8秒以内に完了する', () => {
		expect(drawingDuration()).toBeLessThanOrEqual(8_000);
		expect(DRAWING_PHASES.map((phase) => phase.id)).toEqual([
			'eyebrow',
			'statement-1',
			'statement-2',
			'lead',
			'hint',
			'works-heading',
			'work-1',
			'work-2',
			'work-3',
			'work-4'
		]);
	});

	it('CSSのms/sトークンを解決し、不正値にはfallbackを使う', () => {
		expect(parseMotionTime('250ms', 1)).toBe(250);
		expect(parseMotionTime('0.5s', 1)).toBe(500);
		expect(parseMotionTime('unset', 123)).toBe(123);

		const styles = { getPropertyValue: () => '10ms' };
		expect(resolveDrawingSchedule(styles).every((phase) => phase.duration === 10)).toBe(true);
	});
});
