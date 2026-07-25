import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	assertCanonicalPreviewFixture,
	assertExpectedPreviewAccountEmail,
	assertExpectedPreviewAccountRole,
	assertPreviewPublicationTarget,
	buildVercelProtectionHeaders,
	EXPECTED_PREVIEW_ACCOUNT_EMAIL,
	EXPECTED_PREVIEW_ACCOUNT_ROLE,
	isCanonicalPreviewFixture,
	loadPlaywrightEnvironment,
	PREVIEW_FIXTURE_DEMO_ID,
	PREVIEW_FIXTURE_EVENT_TYPE,
	PREVIEW_FIXTURE_SLUG,
	PREVIEW_FIXTURE_TITLE,
	resolvePlaywrightRuntimeEnvironment,
	selectCanonicalPreviewFixture,
	validateAuthenticatedPreviewEnvironment,
	type PreviewFixtureIdentity,
} from '../../scripts/playwright/preview-environment';

const previewBaseUrl = 'https://celebra-example-team.vercel.app';
const fixtureId = '00000000-0000-4000-8000-000000000001';
const ownerId = '11111111-1111-4111-8111-111111111111';

function validPreviewEnvironment(): NodeJS.ProcessEnv {
	return {
		PLAYWRIGHT_BASE_URL: previewBaseUrl,
		PLAYWRIGHT_HOST_LOGIN: EXPECTED_PREVIEW_ACCOUNT_EMAIL,
		PLAYWRIGHT_HOST_PASSWORD: 'password-placeholder',
		VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass-placeholder',
		PLAYWRIGHT_PREVIEW_INVITATION_ID: fixtureId,
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

		expect(() => validateAuthenticatedPreviewEnvironment(env)).toThrow('*.vercel.app');
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
				requireFixtureId: false,
				requireProvisioningAuthorization: true,
			}),
		).toThrow('PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING');
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
			}),
		).not.toThrow();

		expect(() =>
			assertPreviewPublicationTarget({
				configuredFixtureId: fixtureId,
				targetInvitationId: '00000000-0000-4000-8000-000000000099',
				targetSlug: PREVIEW_FIXTURE_SLUG,
			}),
		).toThrow('invitation id does not match');

		expect(() =>
			assertPreviewPublicationTarget({
				configuredFixtureId: fixtureId,
				targetInvitationId: fixtureId,
				targetSlug: 'demo-xv-jewelry-box',
			}),
		).toThrow(PREVIEW_FIXTURE_SLUG);
	});

	it('does not treat publication as authorized by fixture provisioning alone', () => {
		const env = validPreviewEnvironment();
		env.PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING = 'true';

		const preview = validateAuthenticatedPreviewEnvironment(env, {
			requireProvisioningAuthorization: true,
		});

		expect(preview.allowFixtureProvisioning).toBe(true);
		expect(preview.allowPublication).toBe(false);
	});
});
