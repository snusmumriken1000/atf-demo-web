import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	classifyRequestUrl,
	routeToFile,
	startStaticServer,
	throwIfViolations
} from './check-runtime-network.mjs';

const origin = 'http://127.0.0.1:4173';

describe('classifyRequestUrl', () => {
	it.each([
		['同じ origin のルート', `${origin}/profile`],
		['同じ origin の query/fragment', `${origin}/showcase?q=1#work`],
		['data URI', 'data:image/svg+xml;base64,PHN2Zy8+']
	])('%s を許可する', (_, url) => {
		expect(classifyRequestUrl(url, origin).allowed).toBe(true);
	});

	it.each([
		['ホストが違う', 'http://localhost:4173/profile'],
		['ポートが違う', 'http://127.0.0.1:4174/profile'],
		['スキームが違う', 'https://127.0.0.1:4173/profile'],
		['サブドメイン風の偽装', 'http://127.0.0.1.example:4173/profile'],
		['protocol-relative URL', '//example.com/profile'],
		['blob URI', 'blob:http://127.0.0.1:4173/id'],
		['javascript URI', 'javascript:void 0'],
		['file URI', 'file:///tmp/profile.html'],
		['不正な URL', 'not a url']
	])('%s を拒否する', (_, url) => {
		expect(classifyRequestUrl(url, origin).allowed).toBe(false);
	});
});

describe('違反診断', () => {
	it('route・method・resource type・URL・理由を含めて失敗する', () => {
		expect(() =>
			throwIfViolations([
				{
					route: '/profile',
					method: 'GET',
					resourceType: 'fetch',
					url: 'https://example.com/private',
					reason: '許可外オリジン'
				}
			])
		).toThrow(/\/profile: GET https:\/\/example\.com\/private \[fetch\] — 許可外オリジン/);
	});

	it('違反がなければ成功する', () => {
		expect(() => throwIfViolations([])).not.toThrow();
	});
});

describe('静的配信サーバー', () => {
	const cleanups: Array<() => Promise<void>> = [];

	afterEach(async () => {
		await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
	});

	async function fixture() {
		const directory = await mkdtemp(join(tmpdir(), 'atf-network-test-'));
		await writeFile(join(directory, 'index.html'), '<h1>home</h1>');
		await writeFile(join(directory, 'showcase.html'), '<h1>showcase</h1>');
		await writeFile(join(directory, 'asset.unknown'), 'binary-ish');
		const { server, origin: fixtureOrigin } = await startStaticServer(directory);
		cleanups.push(
			() => new Promise<void>((resolve) => server.close(() => resolve())),
			() => rm(directory, { recursive: true, force: true })
		);
		return fixtureOrigin;
	}

	it('OS が割り当てた動的ポートで route と MIME type を配信する', async () => {
		const fixtureOrigin = await fixture();
		expect(new URL(fixtureOrigin).port).toMatch(/^\d+$/);

		const routeResponse = await fetch(`${fixtureOrigin}/showcase`);
		expect(routeResponse.status).toBe(200);
		expect(routeResponse.headers.get('content-type')).toBe('text/html; charset=utf-8');
		expect(await routeResponse.text()).toContain('showcase');

		const fallbackMimeResponse = await fetch(`${fixtureOrigin}/asset.unknown`);
		expect(fallbackMimeResponse.headers.get('content-type')).toBe('application/octet-stream');
	});

	it('存在しないファイルと build 外への traversal を 404 にする', async () => {
		const fixtureOrigin = await fixture();
		expect((await fetch(`${fixtureOrigin}/missing.js`)).status).toBe(404);
		expect((await fetch(`${fixtureOrigin}/%2e%2e/%2e%2e/etc/passwd`)).status).toBe(404);
	});

	it('不正な percent encoding を 400 にする', async () => {
		const fixtureOrigin = await fixture();
		expect((await fetch(`${fixtureOrigin}/%ZZ`)).status).toBe(400);
	});
});

describe('routeToFile', () => {
	it.each([
		['/', '/index.html'],
		['/showcase', '/showcase.html'],
		['/showcase/', '/showcase.html'],
		['/profile', '/profile.html'],
		['/profile/', '/profile.html'],
		['/_app/app.js', '/_app/app.js']
	])('%s を %s に解決する', (route, expected) => {
		expect(routeToFile(route)).toBe(expected);
	});
});
