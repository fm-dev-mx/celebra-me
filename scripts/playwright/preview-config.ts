import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { PREVIEW_OUTPUT_ROOT } from './preview-environment';

/**
 * Shared shape of the external Preview Playwright configs (`playwright.preview*.config.ts`).
 *
 * Each config file keeps its own load-time environment validation and execution-mode marker;
 * this factory only owns the invariants they share: one serial worker, no retries, no retained
 * browser state, and no traces, screenshots, videos, or preserved output.
 */
export interface PreviewPlaywrightConfigOptions {
	/** Validated Preview origin returned by the config's own environment check. */
	baseURL: string;
	/** Spec files under `tests/e2e/preview`. */
	testMatch: string[];
	/** Subdirectory of `PREVIEW_OUTPUT_ROOT` for this config's (discarded) output. */
	outputName: string;
	projectName: string;
	grep?: RegExp;
	grepInvert?: RegExp;
	timeout?: number;
}

export function definePreviewPlaywrightConfig({
	baseURL,
	testMatch,
	outputName,
	projectName,
	...selection
}: PreviewPlaywrightConfigOptions): PlaywrightTestConfig {
	return defineConfig({
		testDir: './tests/e2e/preview',
		testMatch,
		...selection,
		fullyParallel: false,
		forbidOnly: true,
		retries: 0,
		workers: 1,
		reporter: 'list',
		outputDir: `${PREVIEW_OUTPUT_ROOT}/${outputName}`,
		preserveOutput: 'never',
		use: {
			...devices['Desktop Chrome'],
			baseURL,
			trace: 'off',
			screenshot: 'off',
			video: 'off',
			storageState: undefined,
		},
		projects: [{ name: projectName }],
	});
}
