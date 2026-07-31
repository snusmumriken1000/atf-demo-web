import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	// vitest 実行時は Svelte のクライアントビルドを解決させる(jsdom コンポーネントテスト用)
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
	test: {
		expect: { requireAssertions: true },
		// テストは 2 プロジェクト構成:
		// - server: node 環境の unit テスト(*.svelte.{test,spec}.ts を除く)
		// - client: jsdom 環境のコンポーネント・attachment テスト(*.svelte.{test,spec}.ts)
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			}
		]
	}
});
