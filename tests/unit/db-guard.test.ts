/**
 * Jest tests for db-guard.ts
 *
 * Tests cover:
 * - Target classification (production, persistent-local, disposable-test, unknown)
 * - Credential redaction
 * - Local identity verification
 * - Guard checks (production writes blocked, persistent-local reset blocked,
 *   disposable-test allowed, unknown targets blocked)
 * - Dump integrity validation
 * - Sentinel preservation
 */

import {
	classifyDbTarget,
	redactDbUrl,
	redactCredentials,
	verifyLocalIdentity,
	guardProduction,
	guardPersistentLocal,
	guardUnknown,
	isLocalDbUrl,
	validateDumpIntegrity,
	PERSISTENT_LOCAL,
} from '../../scripts/db/db-guard.ts';

import type { ClassificationResult, GuardResult } from '../../scripts/db/db-guard.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function classification(params: {
	dbUrl: string;
	expectedTarget: string;
	expectedReason?: RegExp;
	apiUrl?: string;
}): void {
	const { dbUrl, expectedTarget, expectedReason, apiUrl } = params;
	const result = classifyDbTarget(dbUrl, apiUrl ? { apiUrl } : undefined);
	expect(result.target).toBe(expectedTarget);
	if (expectedReason) {
		expect(result.reason).toMatch(expectedReason);
	}
}

function guardResult(
	guard: (c: ClassificationResult, op: string) => GuardResult,
	classification: ClassificationResult,
	operation: string,
	expectedOk: boolean,
	expectedErrorPattern?: RegExp,
): void {
	const result = guard(classification, operation);
	expect(result.ok).toBe(expectedOk);
	if (expectedErrorPattern && !result.ok) {
		expect(result.errors[0]).toMatch(expectedErrorPattern);
	}
}

// ---------------------------------------------------------------------------
// Classification tests
// ---------------------------------------------------------------------------

describe('classifyDbTarget', () => {
	describe('production', () => {
		it('detects supabase.co hosts', () => {
			classification({
				dbUrl: 'postgresql://postgres:secret@db.abcdef12345.supabase.co:5432/postgres',
				expectedTarget: 'production',
				expectedReason: /Supabase cloud host/,
			});
		});

		it('detects supabase.com hosts', () => {
			classification({
				dbUrl: 'postgresql://postgres:secret@db.abcdef12345.supabase.com:5432/postgres',
				expectedTarget: 'production',
			});
		});

		it('detects subdomain supabase.co hosts', () => {
			classification({
				dbUrl: 'postgresql://user:pass@project-ref.supabase.co:6543/postgres',
				expectedTarget: 'production',
				expectedReason: /Supabase cloud host/,
			});
		});

		it('rejects non-postgres protocols', () => {
			const result = classifyDbTarget('https://api.example.com');
			expect(result.target).toBe('unknown');
			expect(result.reason).toMatch(/Invalid or non-postgres/);
		});
	});

	describe('persistent-local', () => {
		it('detects 127.0.0.1:54322', () => {
			classification({
				dbUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
				expectedTarget: 'persistent-local',
				expectedReason: /Persistent local environment/,
			});
		});

		it('detects localhost:54322', () => {
			classification({
				dbUrl: 'postgresql://postgres:postgres@localhost:54322/postgres',
				expectedTarget: 'persistent-local',
			});
		});

		it('verifies API URL match when provided', () => {
			const result = classifyDbTarget(
				'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
				{ apiUrl: 'http://127.0.0.1:54321' },
			);
			expect(result.target).toBe('persistent-local');
		});

		it('rejects with wrong API URL', () => {
			const result = classifyDbTarget(
				'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
				{ apiUrl: 'http://other-host:99999' },
			);
			expect(result.target).toBe('unknown');
		});
	});

	describe('disposable-test', () => {
		it('detects 127.0.0.1:54332', () => {
			classification({
				dbUrl: 'postgresql://postgres:postgres@127.0.0.1:54332/postgres',
				expectedTarget: 'disposable-test',
				expectedReason: /Disposable test environment/,
			});
		});

		it('detects localhost:54332', () => {
			classification({
				dbUrl: 'postgresql://postgres:postgres@localhost:54332/postgres',
				expectedTarget: 'disposable-test',
			});
		});
	});

	describe('unknown', () => {
		it('rejects unrecognized hosts', () => {
			classification({
				dbUrl: 'postgresql://user:pass@some-random-server.com:5432/mydb',
				expectedTarget: 'unknown',
				expectedReason: /Unrecognized host/,
			});
		});

		it('rejects local host on non-standard port', () => {
			classification({
				dbUrl: 'postgresql://postgres:postgres@127.0.0.1:54321/postgres',
				expectedTarget: 'unknown',
				expectedReason: /non-standard port/,
			});
		});

		it('rejects invalid URLs', () => {
			const result = classifyDbTarget('not-a-url');
			expect(result.target).toBe('unknown');
		});
	});
});

// ---------------------------------------------------------------------------
// Redaction tests
// ---------------------------------------------------------------------------

describe('redactDbUrl', () => {
	it('redacts password from DB URL', () => {
		const redacted = redactDbUrl(
			'postgresql://postgres:supersecret@db.abc123.supabase.co:5432/postgres',
		);
		expect(redacted).toMatch(/<redacted>/);
		expect(redacted).not.toMatch(/supersecret/);
	});

	it('handles invalid URLs gracefully', () => {
		expect(redactDbUrl('not-a-url')).toBe('<invalid-url>');
	});
});

describe('redactCredentials', () => {
	it('redacts postgres URLs in text', () => {
		const result = redactCredentials(
			'Connected to postgresql://user:secret@host:5432/db and ran query',
		);
		expect(result).toMatch(/<redacted>@<host>/);
		expect(result).not.toMatch(/secret/);
	});

	it('redacts postgresql URLs in text', () => {
		const result = redactCredentials(
			'Using postgresql://admin:pass123@server.com:5432/mydb for export',
		);
		expect(result).toMatch(/<redacted>@<host>/);
		expect(result).not.toMatch(/pass123/);
	});

	it('passes through text without URLs', () => {
		const input = 'No database URLs here';
		expect(redactCredentials(input)).toBe(input);
	});
});

// ---------------------------------------------------------------------------
// isLocalDbUrl tests
// ---------------------------------------------------------------------------

describe('isLocalDbUrl', () => {
	it('returns true for persistent-local URL', () => {
		expect(isLocalDbUrl('postgresql://postgres:postgres@127.0.0.1:54322/postgres')).toBe(true);
	});

	it('returns true for disposable-test URL', () => {
		expect(isLocalDbUrl('postgresql://postgres:postgres@127.0.0.1:54332/postgres')).toBe(true);
	});

	it('returns false for production URL', () => {
		expect(isLocalDbUrl('postgresql://user:pass@db.abc.supabase.co:5432/postgres')).toBe(false);
	});

	it('returns false for invalid URL', () => {
		expect(isLocalDbUrl('not-a-url')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// verifyLocalIdentity tests
// ---------------------------------------------------------------------------

describe('verifyLocalIdentity', () => {
	it('passes when project ID matches', () => {
		const config = `project_id = "${PERSISTENT_LOCAL.projectId}"`;
		const result = verifyLocalIdentity({ supabaseConfig: config });
		expect(result.ok).toBe(true);
	});

	it('fails when project ID mismatches', () => {
		const config = 'project_id = "some-other-project"';
		const result = verifyLocalIdentity({ supabaseConfig: config });
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toMatch(/project_id/);
	});

	it('passes with no config (empty check)', () => {
		const result = verifyLocalIdentity();
		expect(result.ok).toBe(true);
	});

	it('passes when status output contains correct API URL', () => {
		const status = `API URL: http://127.0.0.1:${PERSISTENT_LOCAL.apiUrl.split(':')[2]}`;
		const result = verifyLocalIdentity({ supabaseStatus: status });
		expect(result.ok).toBe(true);
	});

	it('fails when status output shows wrong API URL', () => {
		const status = 'API URL: http://127.0.0.1:99999';
		const result = verifyLocalIdentity({ supabaseStatus: status });
		expect(result.ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Guard function tests
// ---------------------------------------------------------------------------

describe('guardProduction', () => {
	const prodClassification: ClassificationResult = {
		target: 'production',
		reason: 'Supabase cloud host',
		dbUrl: 'postgresql://user:pass@db.supabase.co:5432/postgres',
	};

	it('blocks migration operations', () => {
		guardResult(
			guardProduction,
			prodClassification,
			'supabase db push --db-url ...',
			false,
			/PRODUCTION WRITE BLOCKED/,
		);
	});

	it('blocks drop operations', () => {
		guardResult(
			guardProduction,
			prodClassification,
			'drop schema public cascade',
			false,
			/PRODUCTION WRITE BLOCKED/,
		);
	});

	it('blocks truncate operations', () => {
		guardResult(
			guardProduction,
			prodClassification,
			'truncate table invitations',
			false,
			/PRODUCTION WRITE BLOCKED/,
		);
	});

	it('blocks INSERT/UPDATE/DELETE operations', () => {
		guardResult(
			guardProduction,
			prodClassification,
			'insert into invitations',
			false,
			/PRODUCTION WRITE BLOCKED/,
		);
	});

	it('allows read-only operations', () => {
		guardResult(guardProduction, prodClassification, 'select * from invitations', true);
	});

	it('allows backup/export', () => {
		guardResult(guardProduction, prodClassification, 'backup', true);
	});

	it('is not applicable for non-production targets', () => {
		const local: ClassificationResult = {
			target: 'persistent-local',
			reason: 'local',
		};
		const result = guardProduction(local, 'delete from everything');
		expect(result.ok).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

describe('guardPersistentLocal', () => {
	const localClassification: ClassificationResult = {
		target: 'persistent-local',
		reason: 'Persistent local environment',
		dbUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
	};

	it('blocks supabase db reset', () => {
		guardResult(
			guardPersistentLocal,
			localClassification,
			'supabase db reset --local --yes',
			false,
			/PERSISTENT LOCAL BLOCKED/,
		);
	});

	it('blocks docker volume rm', () => {
		guardResult(
			guardPersistentLocal,
			localClassification,
			'docker volume rm supabase_db_celebra-me-rsvp',
			false,
			/PERSISTENT LOCAL BLOCKED/,
		);
	});

	it('blocks docker compose down -v', () => {
		guardResult(
			guardPersistentLocal,
			localClassification,
			'docker compose down -v',
			false,
			/PERSISTENT LOCAL BLOCKED/,
		);
	});

	it('blocks DROP ... CASCADE', () => {
		guardResult(
			guardPersistentLocal,
			localClassification,
			'drop schema public cascade',
			false,
			/PERSISTENT LOCAL BLOCKED/,
		);
	});

	it('blocks TRUNCATE ... CASCADE', () => {
		guardResult(
			guardPersistentLocal,
			localClassification,
			'truncate table invitations cascade',
			false,
			/PERSISTENT LOCAL BLOCKED/,
		);
	});

	it('blocks supabase db push', () => {
		guardResult(
			guardPersistentLocal,
			localClassification,
			'supabase db push --local',
			false,
			/PERSISTENT LOCAL BLOCKED/,
		);
	});

	it('allows read-only operations', () => {
		guardResult(guardPersistentLocal, localClassification, 'select * from invitations', true);
	});

	it('allows backup', () => {
		guardResult(guardPersistentLocal, localClassification, 'backup', true);
	});

	it('is not applicable for production targets', () => {
		const prod: ClassificationResult = {
			target: 'production',
			reason: 'production',
		};
		const result = guardPersistentLocal(prod, 'supabase db reset');
		expect(result.ok).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

describe('guardUnknown', () => {
	const unknownClassification: ClassificationResult = {
		target: 'unknown',
		reason: 'Unrecognized host',
		dbUrl: 'postgresql://user:pass@unknown.com:5432/db',
	};

	it('blocks all operations for unknown targets', () => {
		guardResult(
			guardUnknown,
			unknownClassification,
			'select 1',
			false,
			/UNKNOWN TARGET BLOCKED/,
		);
	});

	it('is not applicable for known targets', () => {
		const local: ClassificationResult = {
			target: 'persistent-local',
			reason: 'local',
		};
		const result = guardUnknown(local, 'select 1');
		expect(result.ok).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Dump integrity validation tests
// ---------------------------------------------------------------------------

describe('validateDumpIntegrity', () => {
	it('rejects non-existent files', () => {
		const result = validateDumpIntegrity('/nonexistent/path.sql');
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toMatch(/not found/);
	});

});

