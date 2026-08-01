/* build/ または公開済み URL を実ブラウザで検証する実行時ネットワーク監視。 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, sep } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROUTES = ['/', '/showcase/', '/profile/'];
const NAVIGATION_TIMEOUT_MS = 10_000;
const QUIET_WINDOW_MS = 300;
const MIN_OBSERVATION_MS = 1_000;
const QUIET_TIMEOUT_MS = 3_000;
const SELF_CHECK_DELAY_MS = 600;
export const DEPLOYMENT_ORIGIN = 'https://snusmumriken1000.github.io';
export const DEPLOYMENT_BASE_PATH = '/atf-demo-web';
const MIME_TYPES = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain; charset=utf-8',
	'.woff2': 'font/woff2'
};

export function normalizeBasePath(value) {
	if (value === '' || value === '/') return '';
	if (
		!/^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+$/.test(value) ||
		value.split('/').some((part) => part === '.' || part === '..')
	) {
		throw new Error('base path は / で始まり / で終わらない安全なパスを指定してください');
	}
	return value;
}

export function classifyRequestUrl(requestUrl, allowedOrigin, basePath = '') {
	let url;
	try {
		url = new URL(requestUrl);
	} catch {
		return { allowed: false, reason: '不正な URL' };
	}
	if (url.protocol === 'data:') return { allowed: true, reason: 'data: URI' };
	const inBase =
		basePath === '' || url.pathname === basePath || url.pathname.startsWith(`${basePath}/`);
	if (
		(url.protocol === 'http:' || url.protocol === 'https:') &&
		url.origin === allowedOrigin &&
		inBase
	) {
		return { allowed: true, reason: '配信元の許可 base 内' };
	}
	return { allowed: false, reason: `許可外 origin・base・scheme (${url.origin}${url.pathname})` };
}

export function routeToFile(pathname, basePath = '') {
	if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return null;
	let route = basePath ? pathname.slice(basePath.length) || '/' : pathname;
	if (route === '/') return '/index.html';
	if (route.endsWith('/')) route = route.slice(0, -1);
	if (route === '/showcase' || route === '/profile') return `${route}/index.html`;
	return route;
}

export function startStaticServer(buildDir, basePath = '') {
	const safeBase = normalizeBasePath(basePath);
	const server = createServer((request, response) => {
		try {
			const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
			const requestedFile = routeToFile(pathname, safeBase);
			if (!requestedFile) {
				response.writeHead(404);
				response.end('Not found');
				return;
			}
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
			response.writeHead(400);
			response.end('Bad request');
		}
	});
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string')
				return reject(new Error('静的サーバーのアドレスを取得できませんでした'));
			resolve({ server, origin: `http://127.0.0.1:${address.port}` });
		});
	});
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForQuiet(getLastRequestAt) {
	const started = Date.now();
	const deadline = started + QUIET_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const now = Date.now();
		if (now - started >= MIN_OBSERVATION_MS && now - getLastRequestAt() >= QUIET_WINDOW_MS) return;
		await delay(50);
	}
	throw new Error(`${QUIET_TIMEOUT_MS}ms 以内にネットワークが静止しませんでした`);
}

async function exerciseDelayedLoading(page, getLastRequestAt) {
	await page.evaluate(async () => {
		await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3_000))]);
		for (
			let y = 0;
			y <= document.documentElement.scrollHeight;
			y += Math.max(1, Math.floor(innerHeight * 0.75))
		) {
			scrollTo(0, y);
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		}
		await Promise.race([
			Promise.allSettled(document.getAnimations().map((a) => a.finished)),
			new Promise((r) => setTimeout(r, 2_000))
		]);
	});
	await waitForQuiet(getLastRequestAt);
}

function observeRequests(page, route, origin, basePath, violations) {
	let lastRequestAt = Date.now();
	page.on('request', (request) => {
		lastRequestAt = Date.now();
		const result = classifyRequestUrl(request.url(), origin, basePath);
		if (!result.allowed)
			violations.push({
				route,
				method: request.method(),
				resourceType: request.resourceType(),
				url: request.url(),
				reason: result.reason
			});
	});
	return () => lastRequestAt;
}

// Playwright の request event は観測用であり、redirect 後の要求を止められない。
// route interception で送出前に許可境界を判定し、公開 URL から base 外へ
// redirect されても接続を開始しない。
export async function installRequestGuard(page, routeName, origin, basePath, violations) {
	await page.route('**/*', async (route) => {
		const request = route.request();
		const result = classifyRequestUrl(request.url(), origin, basePath);
		if (result.allowed) {
			await route.continue();
			return;
		}
		violations.push({
			route: routeName,
			method: request.method(),
			resourceType: request.resourceType(),
			url: request.url(),
			reason: result.reason
		});
		await route.abort('blockedbyclient');
	});
}

export function throwIfViolations(violations) {
	if (!violations.length) return;
	throw new Error(
		`許可外のネットワークリクエストを検出しました:\n${violations.map(({ route, method, resourceType, url, reason }) => `  - ${route}: ${method} ${url} [${resourceType}] — ${reason}`).join('\n')}`
	);
}

const routeUrl = (origin, basePath, route) => `${origin}${basePath}${route}`;
async function verifyRoute(browser, origin, basePath, route, violations, guardRequests) {
	const context = await browser.newContext();
	try {
		const page = await context.newPage();
		if (guardRequests) await installRequestGuard(page, route, origin, basePath, violations);
		const last = observeRequests(page, route, origin, basePath, violations);
		const response = await page.goto(routeUrl(origin, basePath, route), {
			waitUntil: 'domcontentloaded',
			timeout: NAVIGATION_TIMEOUT_MS
		});
		if (!response?.ok())
			throw new Error(`${route} の直接アクセスが HTTP ${response?.status() ?? 'unknown'} でした`);
		await exerciseDelayedLoading(page, last);
	} finally {
		await context.close().catch(() => {});
	}
}

async function verifyInternalNavigation(browser, origin, basePath, violations, guardRequests) {
	const context = await browser.newContext();
	try {
		const page = await context.newPage();
		if (guardRequests) await installRequestGuard(page, '内部遷移', origin, basePath, violations);
		const last = observeRequests(page, '内部遷移', origin, basePath, violations);
		await page.goto(routeUrl(origin, basePath, '/'), {
			waitUntil: 'domcontentloaded',
			timeout: NAVIGATION_TIMEOUT_MS
		});
		for (const route of ['/showcase', '/profile', '/']) {
			await page.locator(`a[href="${basePath}${route}"]`).first().click();
			const expectedPath = `${basePath}${route}`.replace(/\/$/, '') || '/';
			await page.waitForURL((url) => (url.pathname.replace(/\/$/, '') || '/') === expectedPath, {
				timeout: NAVIGATION_TIMEOUT_MS
			});
		}
		await exerciseDelayedLoading(page, last);
	} finally {
		await context.close().catch(() => {});
	}
}

async function verifyMonitorSelfCheck(browser, origin, basePath) {
	const context = await browser.newContext();
	try {
		const page = await context.newPage();
		const violations = [];
		const last = observeRequests(page, '敵対的自己検査', origin, basePath, violations);
		await page.route('https://runtime-network-smoke.invalid/**', (route) =>
			route.abort('blockedbyclient')
		);
		await page.goto(routeUrl(origin, basePath, '/'), {
			waitUntil: 'domcontentloaded',
			timeout: NAVIGATION_TIMEOUT_MS
		});
		await page.evaluate(
			(ms) =>
				setTimeout(
					() =>
						void fetch(`https://${['runtime-network-smoke', 'invalid'].join('.')}/probe`).catch(
							() => {}
						),
					ms
				),
			SELF_CHECK_DELAY_MS
		);
		await waitForQuiet(last);
		if (!violations.some((v) => v.url === 'https://runtime-network-smoke.invalid/probe'))
			throw new Error('敵対的自己検査に失敗しました');
	} finally {
		await context.close().catch(() => {});
	}
}

export function parseTargetUrl(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error('公開 URL が不正です');
	}
	if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
		throw new Error('公開 URL は credential/query/fragment のない HTTPS URL を指定してください');
	const basePath = normalizeBasePath(url.pathname.replace(/\/$/, ''));
	if (url.origin !== DEPLOYMENT_ORIGIN || basePath !== DEPLOYMENT_BASE_PATH) {
		throw new Error(`公開 URL は ${DEPLOYMENT_ORIGIN}${DEPLOYMENT_BASE_PATH}/ に限定されています`);
	}
	return { origin: url.origin, basePath };
}

export async function runRuntimeNetworkCheck(targetUrl = process.argv[2]) {
	let server;
	let browser;
	try {
		let target;
		const remoteMode = Boolean(targetUrl);
		if (targetUrl) target = parseTargetUrl(targetUrl);
		else {
			const buildDir = join(process.cwd(), 'build');
			if (!existsSync(buildDir)) throw new Error('build/ がありません');
			const basePath = normalizeBasePath(process.env.BASE_PATH ?? '');
			const started = await startStaticServer(buildDir, basePath);
			server = started.server;
			target = { origin: started.origin, basePath };
		}
		browser = await chromium.launch({ headless: true });
		const violations = [];
		for (const route of ROUTES)
			await verifyRoute(browser, target.origin, target.basePath, route, violations, remoteMode);
		await verifyInternalNavigation(browser, target.origin, target.basePath, violations, remoteMode);
		await verifyMonitorSelfCheck(browser, target.origin, target.basePath);
		throwIfViolations(violations);
		console.log(`check-runtime-network: OK(3 route, base=${target.basePath || '/'})`);
	} finally {
		await browser?.close().catch(() => {});
		if (server) await new Promise((r) => server.close(r));
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
	runRuntimeNetworkCheck().catch((error) => {
		console.error('check-runtime-network: NG');
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
