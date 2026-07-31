import { describe, expect, expectTypeOf, it } from 'vitest';
import type { WorkLink } from './content.types';

describe('WorkLink', () => {
	it('https URL だけを型として受け付ける', () => {
		const link = { label: 'GitHub', url: 'https://github.com/example' } satisfies WorkLink;
		expectTypeOf(link.url).toMatchTypeOf<`https://${string}`>();
		expect(link.url).toBe('https://github.com/example');

		// @ts-expect-error javascript: URL は href に出力できない
		const javascriptLink: WorkLink = { label: 'Unsafe', url: 'javascript:alert(1)' };
		// @ts-expect-error 暗号化されていない http: URL も契約外
		const httpLink: WorkLink = { label: 'Unsafe', url: 'http://example.com' };
		expect(javascriptLink.url).toBe('javascript:alert(1)');
		expect(httpLink.url).toBe('http://example.com');
	});
});
