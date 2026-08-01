import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(fileURLToPath(new URL('./+layout.svelte', import.meta.url)), 'utf8');
const app = readFileSync(fileURLToPath(new URL('../app.html', import.meta.url)), 'utf8');

describe('site icon head metadata', () => {
	it('links SVG, ICO and Apple touch icon imports', () => {
		expect(layout).toContain("import faviconSvg from '$lib/assets/favicon.svg'");
		expect(layout).toContain("import faviconIco from '$lib/assets/favicon.ico'");
		expect(layout).toContain("import appleTouchIcon from '$lib/assets/apple-touch-icon.png'");
		expect(layout).toContain('rel="icon" href={faviconSvg} type="image/svg+xml"');
		expect(layout).toContain('rel="icon" href={faviconIco} sizes="16x16 32x32"');
		expect(layout).toContain('rel="apple-touch-icon" href={appleTouchIcon} sizes="180x180"');
	});

	it('sets a theme color matching the icon background', () => {
		expect(layout).toContain('<meta name="theme-color" content="#0b0f1a" />');
	});
});

describe('initial motion state', () => {
	it('marks normal motion before Svelte head and leaves no-JS markup untouched', () => {
		const marker = 'document.documentElement.dataset.motion = matchMedia(';
		expect(app).toContain(marker);
		expect(app.indexOf(marker)).toBeLessThan(app.indexOf('%sveltekit.head%'));
		expect(app).toContain("? 'reduce'");
		expect(app).toContain(": 'animate'");
		expect(app).not.toContain('<html data-motion=');
	});
});
