/** @jest-environment node */
import { execFileSync } from 'node:child_process';

describe('Astro React integration', () => {
	it.each(['dev', 'build'])('registers React island rendering for %s', (command) => {
		// Run the real ESM integration outside Jest's CJS transform and virtual mocks.
		const output = execFileSync(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				`
				import react from '@astrojs/react';
				const renderers = [];
				const scripts = [];
				let vite;
				react().hooks['astro:config:setup']({
					command: ${JSON.stringify(command)},
					addRenderer: renderer => renderers.push(renderer),
					updateConfig: config => { vite = config.vite; },
					injectScript: (stage, code) => scripts.push({ stage, code }),
				});
				const plugins = vite.plugins.flat(Infinity);
				const refresh = plugins.find(plugin => plugin.name === 'vite:react-babel');
				const config = await refresh.config({}, { command: ${JSON.stringify(command === 'dev' ? 'serve' : 'build')} });
				console.log(JSON.stringify({
					renderers,
					scripts,
					excludesAstro: config.oxc.jsxRefreshExclude.some(pattern => pattern.test('Page.astro')),
				}));
				`,
			],
			{ cwd: process.cwd(), encoding: 'utf8', timeout: 20_000 },
		);
		const result = JSON.parse(output);
		expect(result.renderers).toEqual([
			expect.objectContaining({
				name: '@astrojs/react',
				clientEntrypoint: '@astrojs/react/client.js',
				serverEntrypoint: '@astrojs/react/server.js',
			}),
		]);
		expect(result.excludesAstro).toBe(true);
		if (command === 'dev') {
			expect(result.scripts).toEqual([
				expect.objectContaining({ stage: 'before-hydration', code: expect.any(String) }),
			]);
		} else {
			expect(result.scripts).toEqual([]);
		}
	});
});
