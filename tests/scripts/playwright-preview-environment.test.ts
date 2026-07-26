import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	assertCanonicalPreviewFixture,
	assertExpectedPreviewAccountEmail,
	assertExpectedPreviewAccountRole,
	assertPreviewPublicationTarget,
	buildVercelProtectionHeaders,
	executePreviewMutation,
	executePreviewRead,
	EXPECTED_PREVIEW_ACCOUNT_EMAIL,
	EXPECTED_PREVIEW_ACCOUNT_ROLE,
	isCanonicalPreviewFixture,
	loadPlaywrightEnvironment,
	PREVIEW_DRAFT_RATE_LIMIT_MAX_REQUESTS,
	PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS,
	PREVIEW_FIXTURE_DEMO_ID,
	PREVIEW_FIXTURE_EVENT_TYPE,
	PREVIEW_FIXTURE_SLUG,
	PREVIEW_FIXTURE_TITLE,
	PREVIEW_OUTPUT_ROOT,
	PREVIEW_SUPABASE_PROJECT_REF,
	PreviewRequestWindowLimiter,
	PRODUCTION_SUPABASE_PROJECT_REF,
	resolvePlaywrightRuntimeEnvironment,
	serializeSafePreviewDiagnostics,
	selectCanonicalPreviewFixture,
	validateAuthenticatedPreviewEnvironment,
	validateReadOnlyPreviewEnvironment,
	type PreviewHttpResponse,
	type PreviewFixtureIdentity,
} from '../../scripts/playwright/preview-environment';

const previewBaseUrl = 'https://celebra-me.vercel.app';
const fixtureId = '00000000-0000-4000-8000-000000000001';
const ownerId = '11111111-1111-4111-8111-111111111111';

function validPreviewEnvironment(): NodeJS.ProcessEnv {
	return {
		PLAYWRIGHT_BASE_URL: previewBaseUrl,
		PLAYWRIGHT_PREVIEW_SUPABASE_URL: `https://${PREVIEW_SUPABASE_PROJECT_REF}.supabase.co`,
		PLAYWRIGHT_HOST_LOGIN: EXPECTED_PREVIEW_ACCOUNT_EMAIL,
		PLAYWRIGHT_HOST_PASSWORD: 'password-placeholder',
		VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass-placeholder',
		PLAYWRIGHT_PREVIEW_INVITATION_ID: fixtureId,
		PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING: 'false',
		PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION: 'false',
		PLAYWRIGHT_PREVIEW_DEBUG_ARTIFACTS: 'false',
	};
}

function response(status: number, headers: Record<string, string> = {}): PreviewHttpResponse {
	return {
		ok: () => status >= 200 && status < 300,
		status: () => status,
		headers: () => headers,
	};
}

function canonicalFixture(overrides: Partial<PreviewFixtureIdentity> = {}): PreviewFixtureIdentity {
	return {
		id: fixtureId,
		kind: 'client',
		slug: PREVIEW_FIXTURE_SLUG,
		title: PREVIEW_FIXTURE_TITLE,
		eventType: PREVIEW_FIXTURE_EVENT_TYPE,
		baseDemoId: PREVIEW_FIXTURE_DEMO_ID,
		clientName: '',
		clientEmail: '',
		clientWhatsapp: '',
		createdBy: ownerId,
		hasRequest: false,
		hasSubmission: false,
		...overrides,
	};
}

describe('Playwright Preview environment', () => {
	it('loads .env.e2e.local without overriding shell or CI values', () => {
		const directory = mkdtempSync(join(tmpdir(), 'celebra-e2e-env-'));
		const env: NodeJS.ProcessEnv = { PLAYWRIGHT_HOST_LOGIN: 'from-shell@example.com' };
		try {
			writeFileSync(
				join(directory, '.env.e2e.local'),
				[
					'PLAYWRIGHT_HOST_LOGIN=from-file@example.com',
					'PLAYWRIGHT_HOST_PASSWORD=from-file',
				].join('\n'),
			);

			const loaded = loadPlaywrightEnvironment({ cwd: directory, env });

			expect(env.PLAYWRIGHT_HOST_LOGIN).toBe('from-shell@example.com');
			expect(env.PLAYWRIGHT_HOST_PASSWORD).toBe('from-file');
			expect(loaded).toEqual(['PLAYWRIGHT_HOST_PASSWORD']);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it('uses the configured local server and starts no external mode by default', () => {
		const runtime = resolvePlaywrightRuntimeEnvironment({});

		expect(runtime.isExternal).toBe(false);
		expect(runtime.isVercelPreview).toBe(false);
		expect(runtime.protectionHeaders).toBeUndefined();
	});

	it('treats equivalent loopback hosts as the configured local server', () => {
		const runtime = resolvePlaywrightRuntimeEnvironment({
			PLAYWRIGHT_BASE_URL: 'http://localhost:4321',
			PLAYWRIGHT_WEB_SERVER_URL: 'http://127.0.0.1:4321',
		});

		expect(runtime.isExternal).toBe(false);
	});

	it('selects external mode when base URL differs from the configured local server', () => {
		const runtime = resolvePlaywrightRuntimeEnvironment({
			PLAYWRIGHT_BASE_URL: 'https://preview.example.test',
		});

		expect(runtime.isExternal).toBe(true);
		expect(runtime.isVercelPreview).toBe(false);
	});

	it('configures both Vercel Deployment Protection headers without inspecting values', () => {
		const headers = buildVercelProtectionHeaders(validPreviewEnvironment());

		expect(headers).toBeDefined();
		expect(Object.keys(headers ?? {}).sort()).toEqual([
			'x-vercel-protection-bypass',
			'x-vercel-set-bypass-cookie',
		]);
	});

	it.each([
		'PLAYWRIGHT_BASE_URL',
		'PLAYWRIGHT_HOST_LOGIN',
		'PLAYWRIGHT_HOST_PASSWORD',
		'VERCEL_AUTOMATION_BYPASS_SECRET',
		'PLAYWRIGHT_PREVIEW_INVITATION_ID',
	])('fails fast when %s is missing', (key) => {
		const env = validPreviewEnvironment();
		delete env[key];

		expect(() => validateAuthenticatedPreviewEnvironment(env)).toThrow(key);
	});

	it('rejects a non-Vercel target before authenticated execution', () => {
		const env = validPreviewEnvironment();
		env.PLAYWRIGHT_BASE_URL = 'https://example.test';

		expect(() => validateAuthenticatedPreviewEnvironment(env)).toThrow('approved Preview');
	});

	it('rejects a non-dedicated Preview login identity', () => {
		const env = validPreviewEnvironment();
		env.PLAYWRIGHT_HOST_LOGIN = 'customer@example.com';

		expect(() => validateAuthenticatedPreviewEnvironment(env)).toThrow(
			EXPECTED_PREVIEW_ACCOUNT_EMAIL,
		);
	});

	it('requires explicit fixture provisioning authorization for that command', () => {
		const env = validPreviewEnvironment();
		delete env.PLAYWRIGHT_PREVIEW_INVITATION_ID;

		expect(() =>
			validateAuthenticatedPreviewEnvironment(env, {
				executionMode: 'provision',
			}),
		).toThrow('provisioning=true');
	});

	it('rejects unexpected Preview account roles with an actionable repair message', () => {
		expect(() =>
			assertExpectedPreviewAccountEmail(EXPECTED_PREVIEW_ACCOUNT_EMAIL),
		).not.toThrow();
		expect(() => assertExpectedPreviewAccountEmail('other@example.com')).toThrow(
			EXPECTED_PREVIEW_ACCOUNT_EMAIL,
		);
		expect(() => assertExpectedPreviewAccountRole(EXPECTED_PREVIEW_ACCOUNT_ROLE)).not.toThrow();
		expect(() => assertExpectedPreviewAccountRole('host_client')).toThrow('app_user_roles');
	});

	it('accepts only the canonical synthetic fixture identity and ownership', () => {
		const fixture = canonicalFixture();
		expect(isCanonicalPreviewFixture(fixture, ownerId)).toBe(true);
		expect(() => assertCanonicalPreviewFixture(fixture, ownerId)).not.toThrow();
		expect(isCanonicalPreviewFixture(canonicalFixture({ createdBy: 'other' }), ownerId)).toBe(
			false,
		);
		expect(
			isCanonicalPreviewFixture(
				canonicalFixture({ clientEmail: 'customer@example.com' }),
				ownerId,
			),
		).toBe(false);
	});

	it('selects the fixture idempotently and refuses customer-linked or duplicate slugs', () => {
		const first = selectCanonicalPreviewFixture([
			canonicalFixture(),
			canonicalFixture({
				id: '00000000-0000-4000-8000-000000000099',
				slug: 'other-invitation',
				title: 'Other',
			}),
		]);
		expect(first?.id).toBe(fixtureId);

		expect(() =>
			selectCanonicalPreviewFixture([
				canonicalFixture(),
				canonicalFixture({ id: '00000000-0000-4000-8000-000000000002' }),
			]),
		).toThrow('not unique');

		expect(() =>
			selectCanonicalPreviewFixture([
				canonicalFixture({ clientName: 'Cliente Real', hasRequest: true }),
			]),
		).toThrow('customer or intake-linked data');
	});

	it('rejects publication targeting for any invitation other than the dedicated fixture', () => {
		expect(() =>
			assertPreviewPublicationTarget({
				configuredFixtureId: fixtureId,
				targetInvitationId: fixtureId,
				targetSlug: PREVIEW_FIXTURE_SLUG,
				targetOwnerEmail: EXPECTED_PREVIEW_ACCOUNT_EMAIL,
				targetEnvironment: 'preview',
			}),
		).not.toThrow();

		expect(() =>
			assertPreviewPublicationTarget({
				configuredFixtureId: fixtureId,
				targetInvitationId: '00000000-0000-4000-8000-000000000099',
				targetSlug: PREVIEW_FIXTURE_SLUG,
				targetOwnerEmail: EXPECTED_PREVIEW_ACCOUNT_EMAIL,
				targetEnvironment: 'preview',
			}),
		).toThrow('invitation id does not match');

		expect(() =>
			assertPreviewPublicationTarget({
				configuredFixtureId: fixtureId,
				targetInvitationId: fixtureId,
				targetSlug: 'demo-xv-jewelry-box',
				targetOwnerEmail: EXPECTED_PREVIEW_ACCOUNT_EMAIL,
				targetEnvironment: 'preview',
			}),
		).toThrow(PREVIEW_FIXTURE_SLUG);
	});

	it('does not treat publication as authorized by fixture provisioning alone', () => {
		const env = validPreviewEnvironment();
		env.PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING = 'true';

		const preview = validateAuthenticatedPreviewEnvironment(env, {
			executionMode: 'provision',
		});

		expect(preview.allowFixtureProvisioning).toBe(true);
		expect(preview.allowPublication).toBe(false);
	});

	it('accepts only approved aliases or an explicitly approved immutable deployment host', () => {
		const immutableHost = 'celebra-abc123-francisco-mendoza-s-projects.vercel.app';
		const env = validPreviewEnvironment();
		env.PLAYWRIGHT_BASE_URL = `https://${immutableHost}`;
		expect(() => validateReadOnlyPreviewEnvironment(env)).toThrow('explicitly approved');

		env.PLAYWRIGHT_APPROVED_PREVIEW_DEPLOYMENT_HOST = immutableHost;
		expect(validateReadOnlyPreviewEnvironment(env).targetEnvironment).toBe('preview');
	});

	it.each([
		'https://arbitrary-project.vercel.app',
		'https://www.celebra-me.com',
		'https://celebra-me.com',
		'http://celebra-me.vercel.app',
	])('rejects unapproved or Production target %s', (baseUrl) => {
		const env = validPreviewEnvironment();
		env.PLAYWRIGHT_BASE_URL = baseUrl;
		expect(() => validateReadOnlyPreviewEnvironment(env)).toThrow();
	});

	it('requires the exact Preview Supabase project and rejects Production', () => {
		const production = validPreviewEnvironment();
		production.PLAYWRIGHT_PREVIEW_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
		expect(() => validateReadOnlyPreviewEnvironment(production)).toThrow('Production Supabase');

		const other = validPreviewEnvironment();
		other.PLAYWRIGHT_PREVIEW_SUPABASE_URL = 'https://other-project.supabase.co';
		expect(() => validateReadOnlyPreviewEnvironment(other)).toThrow(
			PREVIEW_SUPABASE_PROJECT_REF,
		);
	});

	it.each([
		'PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING',
		'PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION',
		'PLAYWRIGHT_PREVIEW_DEBUG_ARTIFACTS',
	])('fails read-only execution when %s is missing or enabled', (key) => {
		const missing = validPreviewEnvironment();
		delete missing[key];
		expect(() => validateReadOnlyPreviewEnvironment(missing)).toThrow(key);

		const enabled = validPreviewEnvironment();
		enabled[key] = 'true';
		expect(() => validateReadOnlyPreviewEnvironment(enabled)).toThrow();
	});

	it('keeps provisioning and publication mutually exclusive', () => {
		const provision = validPreviewEnvironment();
		provision.PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING = 'true';
		provision.PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION = 'true';
		expect(() =>
			validateAuthenticatedPreviewEnvironment(provision, { executionMode: 'provision' }),
		).toThrow('publication=false');

		const publication = validPreviewEnvironment();
		publication.PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION = 'true';
		delete publication.PLAYWRIGHT_PREVIEW_INVITATION_ID;
		expect(() =>
			validateAuthenticatedPreviewEnvironment(publication, { executionMode: 'publication' }),
		).toThrow('PLAYWRIGHT_PREVIEW_INVITATION_ID');
	});

	it('requires the canonical owner and verified Preview environment for publication', () => {
		const target = {
			configuredFixtureId: fixtureId,
			targetInvitationId: fixtureId,
			targetSlug: PREVIEW_FIXTURE_SLUG,
			targetOwnerEmail: EXPECTED_PREVIEW_ACCOUNT_EMAIL,
			targetEnvironment: 'preview',
		};
		expect(() =>
			assertPreviewPublicationTarget({ ...target, targetOwnerEmail: 'other@example.com' }),
		).toThrow(EXPECTED_PREVIEW_ACCOUNT_EMAIL);
		expect(() =>
			assertPreviewPublicationTarget({ ...target, targetEnvironment: 'production' }),
		).toThrow('verified Preview');
	});

	it('honors Retry-After and bounds safe read retries', async () => {
		const delays: number[] = [];
		let successfulCalls = 0;
		const successful = await executePreviewRead(
			'Fixture read',
			async () => {
				successfulCalls += 1;
				return successfulCalls === 1
					? response(429, { 'Retry-After': '2' })
					: response(200);
			},
			{ sleep: async (delay) => void delays.push(delay) },
		);
		expect(successful.status()).toBe(200);
		expect(delays).toEqual([2000]);

		let boundedCalls = 0;
		await expect(
			executePreviewRead(
				'Bounded fixture read',
				async () => {
					boundedCalls += 1;
					return response(429, { 'retry-after': '0' });
				},
				{ sleep: async () => undefined },
			),
		).rejects.toThrow('retries=2');
		expect(boundedCalls).toBe(3);
	});

	it.each(['not-a-delay', '61'])(
		'fails safely for invalid Retry-After %s',
		async (retryAfter) => {
			let calls = 0;
			const error = (await executePreviewRead(
				'Safe fixture read',
				async () => {
					calls += 1;
					return response(429, { 'Retry-After': retryAfter });
				},
				{ sleep: async () => undefined },
			).catch((caught: unknown) => caught as Error)) as Error;
			expect(calls).toBe(1);
			expect(error.message).toContain('retry-after=invalid');
			expect(error.message).not.toContain(retryAfter);
		},
	);

	it('never replays a failed mutation and sanitizes its diagnostic operation', async () => {
		let calls = 0;
		const error = (await executePreviewMutation('Publish token=super-secret', async () => {
			calls += 1;
			return response(429, { 'Retry-After': '1' });
		}).catch((caught: unknown) => caught as Error)) as Error;
		expect(calls).toBe(1);
		expect(error.message).toContain('retries=0');
		expect(error.message).toContain('retry-after=not-retried');
		expect(error.message).not.toContain('super-secret');
	});

	it('sanitizes thrown transport errors without exposing request details', async () => {
		const readError = (await executePreviewRead('Read secret=hidden', async () => {
			throw new Error('https://secret.example?token=raw-secret');
		}).catch((caught: unknown) => caught as Error)) as Error;
		const mutationError = (await executePreviewMutation('Mutation secret=hidden', async () => {
			throw new Error('csrf=raw-secret');
		}).catch((caught: unknown) => caught as Error)) as Error;

		expect(readError.message).toBe('Preview request failed with HTTP unavailable; retries=0.');
		expect(mutationError.message).toBe(
			'Preview request failed with HTTP unavailable; retries=0.',
		);
		expect(`${readError.message}${mutationError.message}`).not.toContain('raw-secret');
	});

	it('paces a full reconciliation below the known draft request limit', async () => {
		let clock = 0;
		const requestTimes: number[] = [];
		const limiter = new PreviewRequestWindowLimiter({
			now: () => clock,
			sleep: async (delayMs) => {
				clock += delayMs;
			},
		});

		for (let request = 0; request < 17; request += 1) {
			await limiter.beforeRequest();
			requestTimes.push(clock);
		}

		for (const start of requestTimes) {
			const count = requestTimes.filter(
				(time) => time >= start && time < start + PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS,
			).length;
			expect(count).toBeLessThanOrEqual(PREVIEW_DRAFT_RATE_LIMIT_MAX_REQUESTS);
		}
		expect(clock).toBe(PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS);
	});

	it('keeps reconciliation to two editor reads and updates content in memory', () => {
		const source = readFileSync(
			join(process.cwd(), 'tests/e2e/preview/provision-preview-fixture.spec.ts'),
			'utf8',
		);
		expect((source.match(/readEditorContext\(/g) ?? []).length).toBe(2);
		expect(source).toContain('applySectionValue(fixtureContent, section, demoValue)');
		expect(source).toContain('draftRateLimiter.beforeRequest()');
		expect(source).not.toContain('/editor/publish');
	});

	it('allows only finite counters and booleans in diagnostics', () => {
		const safe = serializeSafePreviewDiagnostics({ login: true, publicStatus: 200 });
		expect(safe).toContain('"publicStatus": 200');
		expect(() =>
			serializeSafePreviewDiagnostics({
				authorizationHeader: 'Bearer secret',
			} as unknown as Record<string, number | boolean>),
		).toThrow('unsupported field');
		expect(() =>
			serializeSafePreviewDiagnostics({
				login: 'password-secret',
			} as unknown as Record<string, number | boolean>),
		).toThrow('finite numbers and booleans');
		expect(safe).not.toContain('password');
	});

	it('keeps Preview artifacts ignored and disables retained browser state', () => {
		const ignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8');
		expect(ignore).toContain(`${PREVIEW_OUTPUT_ROOT}/`);

		for (const config of [
			'playwright.preview.config.ts',
			'playwright.preview-public.config.ts',
			'playwright.preview-provision.config.ts',
			'playwright.preview-publication.config.ts',
		]) {
			const source = readFileSync(join(process.cwd(), config), 'utf8');
			expect(source).toContain("trace: 'off'");
			expect(source).toContain("screenshot: 'off'");
			expect(source).toContain("video: 'off'");
			expect(source).toContain('storageState: undefined');
			expect(source).toContain("preserveOutput: 'never'");
		}
	});
});
