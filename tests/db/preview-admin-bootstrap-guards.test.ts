import { describe, expect, it } from '@jest/globals';
import {
	PREVIEW_ADMIN_BOOTSTRAP_SCOPE,
	assertPreviewAdminBootstrapDbTarget,
	buildPreviewAdminApplySql,
	buildPreviewAdminStatusSql,
	isPreviewAdminReady,
	parsePreviewAdminBootstrapArgs,
	parsePreviewAdminStatus,
	requirePreviewAdminCredentials,
} from '../../scripts/db/preview-admin-bootstrap-guards';
import { verifyPreviewWriteAuthorization } from '../../scripts/provision/preview-write-auth';

const PREVIEW_URL =
	'postgresql://postgres.iwipdvisoyerfdytuhwi:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const PRODUCTION_URL =
	'postgresql://postgres.ineitkdkyrxqyressllp:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const OTHER_URL =
	'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const PASSWORD = 'Preview-Test-Secret-1';

describe('parsePreviewAdminBootstrapArgs', () => {
	it('defaults to dry-run', () => {
		expect(parsePreviewAdminBootstrapArgs([])).toEqual({
			apply: false,
			json: false,
			help: false,
		});
	});

	it('accepts --apply and --json', () => {
		expect(parsePreviewAdminBootstrapArgs(['--apply', '--json'])).toMatchObject({
			apply: true,
			json: true,
		});
	});

	it('rejects unknown flags and --apply with --dry-run', () => {
		expect(() => parsePreviewAdminBootstrapArgs(['--force'])).toThrow('Unknown argument');
		expect(() => parsePreviewAdminBootstrapArgs(['--apply', '--dry-run'])).toThrow(
			'mutually exclusive',
		);
	});
});

describe('assertPreviewAdminBootstrapDbTarget', () => {
	it('accepts the canonical Preview project', () => {
		expect(assertPreviewAdminBootstrapDbTarget(PREVIEW_URL)).toBe('iwipdvisoyerfdytuhwi');
	});

	it('always rejects the Production project', () => {
		expect(() => assertPreviewAdminBootstrapDbTarget(PRODUCTION_URL)).toThrow(
			'PREVIEW_ADMIN_BOOTSTRAP_PRODUCTION_REJECTED',
		);
	});

	it('rejects any other project, local and unparsable URLs', () => {
		expect(() => assertPreviewAdminBootstrapDbTarget(OTHER_URL)).toThrow(
			'PREVIEW_ADMIN_BOOTSTRAP_TARGET_REJECTED',
		);
		expect(() =>
			assertPreviewAdminBootstrapDbTarget(
				'postgresql://postgres:pw@127.0.0.1:54322/postgres',
			),
		).toThrow('PREVIEW_ADMIN_BOOTSTRAP_TARGET_REJECTED');
		expect(() => assertPreviewAdminBootstrapDbTarget('not a url')).toThrow(
			'PREVIEW_ADMIN_BOOTSTRAP_TARGET_REJECTED',
		);
	});

	it('never echoes the DB password in the error', () => {
		expect(() => assertPreviewAdminBootstrapDbTarget(PRODUCTION_URL)).not.toThrow(/:pw@/);
	});
});

describe('requirePreviewAdminCredentials', () => {
	it('returns the Preview admin identity', () => {
		expect(
			requirePreviewAdminCredentials({
				PLAYWRIGHT_HOST_LOGIN: 'Preview@Preview.com',
				PLAYWRIGHT_HOST_PASSWORD: PASSWORD,
			}),
		).toEqual({ email: 'preview@preview.com', password: PASSWORD });
	});

	it('rejects any other login', () => {
		expect(() =>
			requirePreviewAdminCredentials({
				PLAYWRIGHT_HOST_LOGIN: 'owner@celebra-me.com',
				PLAYWRIGHT_HOST_PASSWORD: PASSWORD,
			}),
		).toThrow('must be exactly preview@preview.com');
	});

	it('rejects missing, padded and short passwords without echoing them', () => {
		const base = { PLAYWRIGHT_HOST_LOGIN: 'preview@preview.com' };
		expect(() => requirePreviewAdminCredentials(base)).toThrow(
			'PLAYWRIGHT_HOST_PASSWORD is required',
		);
		expect(() =>
			requirePreviewAdminCredentials({ ...base, PLAYWRIGHT_HOST_PASSWORD: ` ${PASSWORD}` }),
		).toThrow('whitespace');
		let message = '';
		try {
			requirePreviewAdminCredentials({ ...base, PLAYWRIGHT_HOST_PASSWORD: 'short' });
		} catch (error: unknown) {
			message = (error as Error).message;
		}
		expect(message).toContain('at least');
		expect(message).not.toContain('short');
	});
});

describe('SQL builders', () => {
	it('status SQL only reads', () => {
		const sql = buildPreviewAdminStatusSql(USER_ID, PASSWORD);
		expect(sql).not.toMatch(/\b(update|insert|delete)\b/i);
		expect(sql).toContain('extensions.crypt');
	});

	it('apply SQL updates the existing admin and never inserts an Auth user', () => {
		const sql = buildPreviewAdminApplySql(USER_ID, PASSWORD);
		expect(sql).not.toMatch(/insert\s+into\s+auth\.users/i);
		expect(sql).toMatch(/update auth\.users/);
		expect(sql).toContain("and email = 'preview@preview.com'");
		expect(sql).toContain('super_admin');
	});

	it('escapes quotes in the password', () => {
		expect(buildPreviewAdminApplySql(USER_ID, "a'b-c-d-e-f")).toContain("'a''b-c-d-e-f'");
	});
});

describe('status parsing', () => {
	const ready = {
		passwordMatches: true,
		emailConfirmed: true,
		metadataRole: 'super_admin',
		appUserRole: 'super_admin',
	};

	it('parses the psql JSON row and reports readiness', () => {
		const status = parsePreviewAdminStatus(`\n${JSON.stringify(ready)}\n`);
		expect(isPreviewAdminReady(status)).toBe(true);
		expect(isPreviewAdminReady({ ...status, passwordMatches: false })).toBe(false);
		expect(isPreviewAdminReady({ ...status, appUserRole: 'host_client' })).toBe(false);
	});

	it('fails on an empty or malformed row', () => {
		expect(() => parsePreviewAdminStatus('')).toThrow('no row');
		expect(() => parsePreviewAdminStatus('{"passwordMatches":"yes"}')).toThrow(
			'unexpected shape',
		);
	});
});

describe('apply authorization', () => {
	it('requires the exact task scope for automated runs', () => {
		expect(() =>
			verifyPreviewWriteAuthorization({
				slug: 'preview-admin',
				operation: 'bootstrap-admin',
				targets: ['preview'],
				apply: true,
				isInteractive: false,
				authToken: 'preview:preview-admin:other-op',
			}),
		).toThrow('scope mismatch');
		expect(
			verifyPreviewWriteAuthorization({
				slug: 'preview-admin',
				operation: 'bootstrap-admin',
				targets: ['preview'],
				apply: true,
				isInteractive: false,
				authToken: PREVIEW_ADMIN_BOOTSTRAP_SCOPE,
			}).actor,
		).toBe('automated_scoped_token');
	});
});
