/**
 * preview-e2e-fixture.test.ts — Preview fixture bootstrap contract
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	getSecretFromEnvOrFiles: jest.fn(() => ''),
	PREVIEW_SECRET_FILES: [],
	runPsql: jest.fn(),
	sqlLiteral: (value: string) => `'${value.replaceAll("'", "''")}'`,
}));

jest.mock('../../scripts/db/db-guard.ts', () => ({
	classifyDbTarget: jest.fn(),
	redactDbUrl: (url: string) => url.replace(/\/\/.*@/, '//***@'),
}));

jest.mock('../../scripts/db/preview-sync-guards.ts', () => ({
	PREVIEW_ADMIN_EMAIL: 'preview@preview.com',
	resolvePreviewAdminUser: jest.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

jest.mock('../../scripts/provision/preview-write-auth.ts', () => ({
	verifyPreviewWriteAuthorization: jest.fn(() => ({
		authorized: true,
		actor: 'automated_scoped_token',
	})),
}));

jest.mock('../../src/lib/intake/demo-preset-catalog.ts', () => ({
	findDemoPreset: jest.fn(() => ({
		id: 'demo-xv-jewelry-box',
		eventType: 'xv',
		themeId: 'jewelry-box',
		displayName: 'XV Años — Jewelry Box',
	})),
}));

import { classifyDbTarget } from '../../scripts/db/db-guard.ts';
import { runPsql } from '../../scripts/db/db-workflow-lib.ts';
import { verifyPreviewWriteAuthorization } from '../../scripts/provision/preview-write-auth.ts';
import {
	ensurePreviewE2eFixture,
	resolvePreviewFixtureDbUrl,
} from '../../scripts/provision/preview-e2e-fixture.ts';
import {
	PREVIEW_FIXTURE_SLUG,
	PREVIEW_FIXTURE_TITLE,
} from '../../scripts/playwright/preview-environment.ts';

const mockedClassify = classifyDbTarget as jest.MockedFunction<typeof classifyDbTarget>;
const mockedPsql = runPsql as jest.MockedFunction<typeof runPsql>;
const mockedAuth = verifyPreviewWriteAuthorization as jest.MockedFunction<
	typeof verifyPreviewWriteAuthorization
>;

const PREVIEW_URL = 'postgresql://user:pass@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres';

describe('preview-e2e-fixture', () => {
	beforeEach(() => {
		mockedClassify.mockReset();
		mockedPsql.mockReset();
		mockedAuth.mockClear();
	});

	it('rejects Production targets', () => {
		mockedClassify.mockReturnValue({
			target: 'production',
			reason: 'production host',
		} as never);
		expect(() =>
			resolvePreviewFixtureDbUrl({ PREVIEW_DB_URL: 'postgresql://prod.example/db' }),
		).toThrow(/PREVIEW_E2E_FIXTURE_PRODUCTION_REJECTED/);
	});

	it('rejects non-Preview targets', () => {
		mockedClassify.mockReturnValue({
			target: 'local',
			reason: 'local host',
		} as never);
		expect(() => resolvePreviewFixtureDbUrl({ PREVIEW_DB_URL: PREVIEW_URL })).toThrow(
			/PREVIEW_E2E_FIXTURE_TARGET_REJECTED/,
		);
	});

	it('allows Preview target resolution', () => {
		mockedClassify.mockReturnValue({
			target: 'preview',
			reason: 'preview host',
		} as never);
		expect(resolvePreviewFixtureDbUrl({ PREVIEW_DB_URL: PREVIEW_URL })).toBe(PREVIEW_URL);
	});

	it('creates when fixture is absent and remains safe when already present', () => {
		mockedClassify.mockReturnValue({
			target: 'preview',
			reason: 'preview host',
		} as never);

		// First call: absent
		mockedPsql.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });
		// insert invitation
		mockedPsql.mockReturnValueOnce({
			status: 0,
			stdout: '22222222-2222-4222-8222-222222222222',
			stderr: '',
		});
		// draft lookup (missing)
		mockedPsql.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });
		// draft insert
		mockedPsql.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });
		// verify load
		mockedPsql.mockReturnValueOnce({
			status: 0,
			stdout: JSON.stringify({
				id: '22222222-2222-4222-8222-222222222222',
				slug: PREVIEW_FIXTURE_SLUG,
				title: PREVIEW_FIXTURE_TITLE,
				event_type: 'xv',
				base_demo_id: 'demo-xv-jewelry-box',
				created_by: '11111111-1111-4111-8111-111111111111',
				client_name: '',
				client_email: '',
				client_whatsapp: '',
			}),
			stderr: '',
		});

		const created = ensurePreviewE2eFixture({
			apply: true,
			authToken: `preview:${PREVIEW_FIXTURE_SLUG}:e2e-fixture`,
			env: { PREVIEW_DB_URL: PREVIEW_URL },
		});
		expect(created.action).toBe('created');
		expect(mockedAuth).toHaveBeenCalled();

		mockedPsql.mockReset();
		mockedPsql
			.mockReturnValueOnce({
				status: 0,
				stdout: JSON.stringify({
					id: created.invitationId,
					slug: PREVIEW_FIXTURE_SLUG,
					title: PREVIEW_FIXTURE_TITLE,
					event_type: 'xv',
					base_demo_id: 'demo-xv-jewelry-box',
					created_by: '11111111-1111-4111-8111-111111111111',
					client_name: '',
					client_email: '',
					client_whatsapp: '',
				}),
				stderr: '',
			})
			.mockReturnValueOnce({
				status: 0,
				stdout: 'draft-id',
				stderr: '',
			});

		const again = ensurePreviewE2eFixture({
			apply: true,
			authToken: `preview:${PREVIEW_FIXTURE_SLUG}:e2e-fixture`,
			env: { PREVIEW_DB_URL: PREVIEW_URL },
		});
		expect(again.action).toBe('already_present');
		expect(again.invitationId).toBe(created.invitationId);
	});
});
