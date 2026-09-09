import { defineConfig, devices } from '@playwright/test';
import { LOCAL_SUPABASE_URL } from './scripts/shared/celebra-runtime-env';
import { resolvePlaywrightRuntimeEnvironment } from './scripts/playwright/preview-environment';

// Intentionally does not load `.env.e2e.local`. That file is for Preview harness configs
// (`playwright.preview*.config.ts`). Loading it here would redirect `pnpm test:e2e:ci` /
// `pnpm run ci` at a protected Preview URL whenever the local Preview env file exists.
const defaultWebServerCommand = [
	JSON.stringify(process.execPath),
	'node_modules/astro/bin/astro.mjs',
	'dev',
	'--host 127.0.0.1 --port 4321 --force',
].join(' ');
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || defaultWebServerCommand;
const runtime = resolvePlaywrightRuntimeEnvironment();
const useCanonicalFixtures = process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES === 'true';
if (
	useCanonicalFixtures &&
	(runtime.isExternal || process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true')
) {
	throw new Error('Canonical fixtures require isolated, Playwright-owned local servers.');
}
if (runtime.isVercelPreview) {
	throw new Error(
		'Protected Vercel Preview targets must use test:e2e:preview:public or test:e2e:preview.',
	);
}

// Canonical CI / local `test:e2e:ci` has no `.env.local`. Astro bootstrap fail-closes without a
// Local Supabase identity, so supply deterministic Local URL stubs when the shell is unset.
const localSupabaseUrl = useCanonicalFixtures
	? LOCAL_SUPABASE_URL
	: process.env.SUPABASE_URL?.trim() || LOCAL_SUPABASE_URL;
const localPublicSupabaseUrl = useCanonicalFixtures
	? LOCAL_SUPABASE_URL
	: process.env.PUBLIC_SUPABASE_URL?.trim() || LOCAL_SUPABASE_URL;
const visualParityMode =
	process.env.VISUAL_PARITY_MODE?.trim() || (process.env.CI ? 'compare' : 'diagnostic');
const visualParitySnapshotRoot =
	process.env.VISUAL_PARITY_SNAPSHOT_ROOT?.trim() ||
	(visualParityMode === 'compare'
		? 'tests/e2e/visual-baselines'
		: '.tmp/visual-parity/candidate');

export default defineConfig({
	globalSetup: './tests/e2e/harness/visual-environment-preflight.ts',
	testDir: './tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	testIgnore: ['preview/**'],
	use: {
		baseURL: runtime.baseURL,
		trace: runtime.isExternal ? 'off' : 'on-first-retry',
		screenshot: 'off',
		video: 'off',
		locale: 'en-US',
		timezoneId: 'UTC',
		deviceScaleFactor: 1,
		viewport: { width: 1280, height: 720 },
	},
	snapshotPathTemplate: `${visualParitySnapshotRoot.replace(/\\/g, '/')}/{arg}{ext}`,
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: runtime.isExternal
		? undefined
		: [
				...(useCanonicalFixtures
					? [
							{
								command: `${JSON.stringify(process.execPath)} --import tsx scripts/playwright/canonical-fixture-server.ts`,
								url: `${LOCAL_SUPABASE_URL}/health`,
								reuseExistingServer: false,
								timeout: 120_000,
							},
						]
					: []),
				{
					command: webServerCommand,
					url: runtime.webServerURL,
					// Astro 7 auto-backgrounds `astro dev` when it detects an agent runtime. Playwright
					// must own a foreground process or it reports an early exit and leaves a detached
					// Windows server behind. This environment marker suppresses that auto-detection.
					// Spread process.env: Playwright replaces the child env when `env` is set.
					env: {
						...process.env,
						ASTRO_DEV_BACKGROUND: '1',
						ENABLE_TEST_VARIANT_HARNESS: '1',
						SUPABASE_URL: localSupabaseUrl,
						PUBLIC_SUPABASE_URL: localPublicSupabaseUrl,
						...(useCanonicalFixtures
							? {
									SUPABASE_ANON_KEY: 'canonical-browser-fixture-not-a-credential',
									SUPABASE_SERVICE_ROLE_KEY:
										'canonical-browser-fixture-not-a-credential',
									PUBLIC_SUPABASE_ANON_KEY:
										'canonical-browser-fixture-not-a-credential',
								}
							: {}),
						CELEBRA_RUNTIME_TARGET:
							process.env.CELEBRA_RUNTIME_TARGET?.trim() || 'local',
					},
					reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true',
					timeout: 120_000,
				},
			],
});
