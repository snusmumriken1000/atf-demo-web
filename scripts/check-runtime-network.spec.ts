import { describe, expect, it } from 'vitest';
import { classifyRequestUrl } from './check-runtime-network.mjs';

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
		['blob URI', 'blob:http://127.0.0.1:4173/id'],
		['file URI', 'file:///tmp/profile.html'],
		['不正な URL', 'not a url']
	])('%s を拒否する', (_, url) => {
		expect(classifyRequestUrl(url, origin).allowed).toBe(false);
	});
});
