import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const assetPath = (name: string) => fileURLToPath(new URL(name, import.meta.url));

const readPngDimensions = (buffer: Buffer) => ({
	width: buffer.readUInt32BE(16),
	height: buffer.readUInt32BE(20)
});

describe('favicon assets', () => {
	it('uses a compact self-contained SVG without the old Svelte logo', () => {
		const svg = readFileSync(assetPath('./favicon.svg'), 'utf8');

		expect(svg).toContain('viewBox="0 0 64 64"');
		expect(svg.match(/<(?:rect|path)\b/g)).toHaveLength(3);
		expect(svg).not.toContain('#ff3e00');
		expect(svg).not.toContain('svelte-logo');
		expect(svg).not.toMatch(/(?:https?:)?\/\/(?!www\.w3\.org\/2000\/svg)/);
	});

	it('includes 16px and 32px images in the ICO', () => {
		const ico = readFileSync(assetPath('./favicon.ico'));
		const imageCount = ico.readUInt16LE(4);
		const dimensions = Array.from({ length: imageCount }, (_, index) => {
			const offset = 6 + index * 16;
			return [ico[offset] || 256, ico[offset + 1] || 256];
		});

		expect(ico.readUInt16LE(0)).toBe(0);
		expect(ico.readUInt16LE(2)).toBe(1);
		expect(dimensions).toEqual(
			expect.arrayContaining([
				[16, 16],
				[32, 32]
			])
		);
	});

	it('provides an opaque 180px Apple touch icon', () => {
		const png = readFileSync(assetPath('./apple-touch-icon.png'));

		expect(png.subarray(1, 4).toString()).toBe('PNG');
		expect(readPngDimensions(png)).toEqual({ width: 180, height: 180 });
		// PNG color type 2 is truecolor without an alpha channel.
		expect(png[25]).toBe(2);
	});
});
