import fs from 'node:fs';
import path from 'node:path';
import { request, type FullConfig } from '@playwright/test';
import { buildVisualPageCases } from '../../../scripts/screenshot/visual-coverage-contract';
import { VISUAL_PARITY_RUNTIME, VISUAL_PARITY_RUNTIME_ENV } from './visual-parity-metadata';
import { beginVisualRecordRun } from './visual-capture-record';

import { assertVisualRuntimeReady } from './visual-baseline-policy';

// Route readiness also warms the on-demand dev server; a few concurrent requests keep that
// bounded without serializing every route behind the previous render.
const PREFLIGHT_CONCURRENCY = 4;

/** Run once before workers; missing publication infrastructure is not a pixel regression. */
export default async function visualEnvironmentPreflight(config: FullConfig): Promise<void> {
	// Workers inherit this process environment: one run identity and one runtime fingerprint.
	beginVisualRecordRun();
	process.env[VISUAL_PARITY_RUNTIME_ENV] = JSON.stringify({
		root: process.cwd(),
		runtime: VISUAL_PARITY_RUNTIME,
	});
	if (process.env.PLAYWRIGHT_REQUIRE_VISUAL_PREFLIGHT !== 'true') return;
	if ((process.env.VISUAL_PARITY_MODE ?? 'compare') === 'compare') {
		const manifest = JSON.parse(
			fs.readFileSync(path.resolve('tests/e2e/visual-baselines/manifest.json'), 'utf8'),
		) as { runtimeFingerprint: Record<string, unknown> };
		assertVisualRuntimeReady(manifest.runtimeFingerprint ?? {}, VISUAL_PARITY_RUNTIME);
	}
	const baseURL = config.projects[0]?.use.baseURL;
	if (!baseURL) throw new Error('Visual environment requires an explicit base URL.');
	const client = await request.newContext({ baseURL, timeout: 10_000 });
	try {
		const routes = buildVisualPageCases().map((entry) => `/${entry.eventType}/${entry.slug}`);
		let next = 0;
		const check = async (): Promise<void> => {
			while (next < routes.length) {
				const route = routes[next++];
				const response = await client.get(route, { maxRedirects: 0 });
				const status = response.status();
				await response.dispose();
				if (status !== 200) {
					throw new Error(
						`Visual environment is not ready: ${route} returned ${status}. ` +
							'Prepare canonical published content and assets in the test environment before running captures. ' +
							'URL stubs alone do not provision invitations. No captures were accepted.',
					);
				}
			}
		};
		await Promise.all(Array.from({ length: PREFLIGHT_CONCURRENCY }, check));
	} finally {
		await client.dispose();
	}
}
