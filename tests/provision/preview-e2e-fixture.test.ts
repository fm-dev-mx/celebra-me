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
	PREVIEW_E2E_FIXTURE_POSTCONDITION,
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
		// published content lookup (missing)
		mockedPsql.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });
		// published content copy from canonical demo
		mockedPsql.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });
		// published content postcondition verification
		mockedPsql.mockReturnValueOnce({ status: 0, stdout: 'published-id', stderr: '' });
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
		expect(created.postcondition).toBe(PREVIEW_E2E_FIXTURE_POSTCONDITION);
		expect(mockedAuth).toHaveBeenCalled();
		expect(
			mockedPsql.mock.calls.some(([sql]) => String(sql).includes('demo-xv-jewelry-box')),
		).toBe(true);

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
			// draft lookup (present)
			.mockReturnValueOnce({
				status: 0,
				stdout: 'draft-id',
				stderr: '',
			})
			// draft update to force divergence marker
			.mockReturnValueOnce({
				status: 0,
				stdout: '',
				stderr: '',
			})
			// published content lookup (present)
			.mockReturnValueOnce({
				status: 0,
				stdout: 'published-id',
				stderr: '',
			});

		const again = ensurePreviewE2eFixture({
			apply: true,
			authToken: `preview:${PREVIEW_FIXTURE_SLUG}:e2e-fixture`,
			env: { PREVIEW_DB_URL: PREVIEW_URL },
		});
		expect(again.action).toBe('already_present');
		expect(again.invitationId).toBe(created.invitationId);
		expect(again.postcondition).toBe(PREVIEW_E2E_FIXTURE_POSTCONDITION);
	});

	it('rejects missing Preview credentials before mutation', () => {
		expect(() => resolvePreviewFixtureDbUrl({})).toThrow(/PREVIEW_E2E_FIXTURE_CREDENTIALS/);
		expect(mockedPsql).not.toHaveBeenCalled();
	});

	it('rejects missing task scope before mutation', () => {
		mockedClassify.mockReturnValue({
			target: 'preview',
			reason: 'preview host',
		} as never);
		mockedAuth.mockImplementationOnce(() => {
			throw new Error(
				'PREVIEW_WRITE_AUTH_REQUIRED: Automated Preview mutation requires CELEBRA_TASK_SCOPE.',
			);
		});

		expect(() =>
			ensurePreviewE2eFixture({
				apply: true,
				env: { PREVIEW_DB_URL: PREVIEW_URL },
			}),
		).toThrow(/PREVIEW_WRITE_AUTH_REQUIRED/);
		expect(mockedPsql).not.toHaveBeenCalled();
	});

	it('surfaces provisioning failure without reporting success', () => {
		mockedClassify.mockReturnValue({
			target: 'preview',
			reason: 'preview host',
		} as never);
		mockedAuth.mockReturnValue({
			authorized: true,
			actor: 'automated_scoped_token',
		});
		// loadActiveFixture → absent
		mockedPsql.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });
		// createFixtureRow insert failure
		mockedPsql.mockReturnValueOnce({
			status: 1,
			stdout: '',
			stderr: 'insert failed',
		});

		expect(() =>
			ensurePreviewE2eFixture({
				apply: true,
				authToken: `preview:${PREVIEW_FIXTURE_SLUG}:e2e-fixture`,
				env: { PREVIEW_DB_URL: PREVIEW_URL },
			}),
		).toThrow(/PREVIEW_E2E_FIXTURE_CREATE_FAILED/);
	});
});
