import fs from 'node:fs';
import path from 'node:path';
import { request, type FullConfig } from '@playwright/test';
import { buildVisualPageCases } from '../../../scripts/screenshot/visual-coverage-contract';
import { VISUAL_PARITY_RUNTIME } from './visual-parity-metadata';

import { assertVisualRuntimeReady } from './visual-baseline-policy';

/** Run once before workers; missing publication infrastructure is not a pixel regression. */
export default async function visualEnvironmentPreflight(config: FullConfig): Promise<void> {
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
		for (const entry of buildVisualPageCases()) {
			const route = `/${entry.eventType}/${entry.slug}`;
			const response = await client.get(route, { maxRedirects: 0 });
			if (response.status() !== 200) {
				throw new Error(
					`Visual environment is not ready: ${route} returned ${response.status()}. ` +
						'Prepare canonical published content and assets in the test environment before running captures. ' +
						'URL stubs alone do not provision invitations. No captures were accepted.',
				);
			}
			await response.dispose();
		}
	} finally {
		await client.dispose();
	}
}
