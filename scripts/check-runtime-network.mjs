/*
 * build/ を実ブラウザで開き、実行時に外部リソースを読み込まないことを検証する。
 *
 * Playwright の test runner は使わず、このファイル単体を Node で実行する。全待機に
 * 上限を設け、失敗時も browser / context / page / server を finally で閉じる。
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, sep } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROUTES = ['/', '/showcase', '/profile'];
const NAVIGATION_TIMEOUT_MS = 10_000;
const FONT_TIMEOUT_MS = 3_000;
const ANIMATION_TIMEOUT_MS = 2_000;
const QUIET_WINDOW_MS = 300;
const MIN_OBSERVATION_MS = 1_000;
const QUIET_TIMEOUT_MS = 3_000;
const SELF_CHECK_DELAY_MS = 600;

const MIME_TYPES = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain; charset=utf-8',
	'.woff2': 'font/woff2'
};

export function classifyRequestUrl(requestUrl, allowedOrigin) {
	let url;
	try {
		url = new URL(requestUrl);
	} catch {
		return { allowed: false, reason: '不正な URL' };
	}

	if (url.protocol === 'data:') return { allowed: true, reason: 'data: URI' };
	if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin === allowedOrigin) {
		return { allowed: true, reason: '配信元と同一オリジン' };
	}
	return { allowed: false, reason: `許可外オリジンまたはスキーム (${url.origin})` };
}

export function routeToFile(pathname) {
	if (pathname === '/') return '/index.html';
	if (pathname === '/showcase' || pathname === '/showcase/') return '/showcase.html';
	if (pathname === '/profile' || pathname === '/profile/') return '/profile.html';
	return pathname;
}

export function startStaticServer(buildDir) {
	const server = createServer((request, response) => {
		try {
			const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
			const requestedFile = routeToFile(pathname);
			const filePath = normalize(join(buildDir, requestedFile));
			const relativePath = relative(buildDir, filePath);

			if (
				relativePath.startsWith(`..${sep}`) ||
				relativePath === '..' ||
				!existsSync(filePath) ||
				!statSync(filePath).isFile()
			) {
				response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
				response.end('Not found');
				return;
			}

			response.writeHead(200, {
				'content-type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
				'cache-control': 'no-store'
			});
			createReadStream(filePath).pipe(response);
		} catch {
			response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
			response.end('Bad request');
		}
	});

	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close();
				reject(new Error('静的サーバーのアドレスを取得できませんでした'));
				return;
			}
			resolve({ server, origin: `http://127.0.0.1:${address.port}` });
		});
	});
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForQuiet(getLastRequestAt) {
	const observationStartedAt = Date.now();
	const deadline = Date.now() + QUIET_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const now = Date.now();
		if (
			now - observationStartedAt >= MIN_OBSERVATION_MS &&
			now - getLastRequestAt() >= QUIET_WINDOW_MS
		)
			return;
		await delay(50);
	}
	throw new Error(`${QUIET_TIMEOUT_MS}ms 以内にネットワークが静止しませんでした`);
}

async function exerciseDelayedLoading(page, getLastRequestAt) {
	await page.evaluate(
		async ({ fontTimeout, animationTimeout }) => {
			const withTimeout = (promise, timeout) =>
				Promise.race([promise, new Promise((resolve) => setTimeout(resolve, timeout))]);

			await withTimeout(document.fonts.ready, fontTimeout);

			const step = Math.max(1, Math.floor(window.innerHeight * 0.75));
			for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
				window.scrollTo(0, y);
				await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			}
			window.scrollTo(0, document.documentElement.scrollHeight);
			await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

			const animations = document.getAnimations();
			await withTimeout(
				Promise.allSettled(animations.map((animation) => animation.finished)),
				animationTimeout
			);
		},
		{ fontTimeout: FONT_TIMEOUT_MS, animationTimeout: ANIMATION_TIMEOUT_MS }
	);

	await waitForQuiet(getLastRequestAt);
}

function observeRequests(page, route, origin, violations) {
	let lastRequestAt = Date.now();
	page.on('request', (request) => {
		lastRequestAt = Date.now();
		const result = classifyRequestUrl(request.url(), origin);
		if (!result.allowed) {
			violations.push({
				route,
				method: request.method(),
				resourceType: request.resourceType(),
				url: request.url(),
				reason: result.reason
			});
		}
	});
	return () => lastRequestAt;
}

export function throwIfViolations(violations) {
	if (violations.length === 0) return;
	const details = violations.map(
		({ route, method, resourceType, url, reason }) =>
			`  - ${route}: ${method} ${url} [${resourceType}] — ${reason}`
	);
	throw new Error(`許可外のネットワークリクエストを検出しました:\n${details.join('\n')}`);
}

async function verifyRoute(browser, origin, route, violations) {
	const context = await browser.newContext();
	let page;
	try {
		page = await context.newPage();
		const getLastRequestAt = observeRequests(page, route, origin, violations);
		await page.goto(`${origin}${route}`, {
			waitUntil: 'domcontentloaded',
			timeout: NAVIGATION_TIMEOUT_MS
		});
		await exerciseDelayedLoading(page, getLastRequestAt);
	} finally {
		await page?.close().catch(() => {});
		await context.close().catch(() => {});
	}
}

async function verifyMonitorSelfCheck(browser, origin) {
	const context = await browser.newContext();
	let page;
	try {
		page = await context.newPage();
		const violations = [];
		const getLastRequestAt = observeRequests(page, '敵対的自己検査', origin, violations);
		await page.route('https://runtime-network-smoke.invalid/**', (route) =>
			route.abort('blockedbyclient')
		);
		await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
		await page.evaluate((selfCheckDelay) => {
			window.setTimeout(() => {
				const host = ['runtime-network-smoke', 'invalid'].join('.');
				void fetch(`https://${host}/probe`).catch(() => {});
			}, selfCheckDelay);
		}, SELF_CHECK_DELAY_MS);
		await waitForQuiet(getLastRequestAt);

		const detected = violations.some(
			(violation) => violation.url === 'https://runtime-network-smoke.invalid/probe'
		);
		if (!detected) throw new Error('敵対的自己検査: 動的な外部 fetch を検出できませんでした');
	} finally {
		await page?.close().catch(() => {});
		await context.close().catch(() => {});
	}
}

export async function runRuntimeNetworkCheck() {
	const buildDir = join(process.cwd(), 'build');
	if (!existsSync(buildDir))
		throw new Error('build/ がありません。先に npm run build を実行してください');

	let server;
	let browser;
	try {
		const started = await startStaticServer(buildDir);
		server = started.server;
		browser = await chromium.launch({ headless: true });
		const violations = [];

		for (const route of ROUTES) {
			await verifyRoute(browser, started.origin, route, violations);
		}
		await verifyMonitorSelfCheck(browser, started.origin);

		throwIfViolations(violations);
		console.log('check-runtime-network: OK(3 ルートの実行時通信は同一オリジン/data: のみ)');
	} finally {
		await browser?.close().catch(() => {});
		if (server) {
			await new Promise((resolve) => server.close(resolve));
		}
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	runRuntimeNetworkCheck().catch((error) => {
		console.error('check-runtime-network: NG');
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
