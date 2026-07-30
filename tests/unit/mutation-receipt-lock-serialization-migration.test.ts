import { readFileSync } from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
	process.cwd(),
	'supabase/migrations/20260730101500_mutation_receipt_lock_serialization.sql',
);
const sql = readFileSync(migrationPath, 'utf8');
const sqlLower = sql.toLowerCase();
const functionBodies = [...sqlLower.matchAll(/\$function\$([\s\S]*?)\$function\$/g)].map(
	(match) => match[1] ?? '',
);

/** Matches a receipt-table reference followed soon by a row-lock clause. */
const receiptRowLockPattern =
	/from\s+public\.invitation_mutation_operation_receipts[\s\S]{0,160}\bfor\s+(?:share|update|no\s+key\s+update|key\s+share)\b/;

describe('mutation receipt lock serialization migration', () => {
	it('replaces both atomic editor RPCs and keeps receipts SELECT+INSERT only', () => {
		expect(sqlLower).toContain(
			'create or replace function public.save_invitation_metadata_atomic',
		);
		expect(sqlLower).toContain(
			'create or replace function public.restore_invitation_from_published_atomic',
		);
		expect(functionBodies).toHaveLength(2);
		expect(sqlLower).toMatch(
			/grant\s+select\s*,\s*insert\s+on\s+table\s+public\.invitation_mutation_operation_receipts/,
		);
		expect(sqlLower).toMatch(
			/revoke\s+update\s*,\s*delete\s+on\s+table\s+public\.invitation_mutation_operation_receipts/,
		);
		expect(sqlLower).not.toMatch(
			/grant\s+(?:update|delete)\b[\s\S]{0,80}invitation_mutation_operation_receipts/,
		);
	});

	it('serializes on the invitation row and never row-locks receipts', () => {
		for (const body of functionBodies) {
			expect(body).toMatch(
				/from\s+public\.invitations[\s\S]{0,120}archived_at\s+is\s+null\s+for\s+update/,
			);
			expect(body).not.toMatch(receiptRowLockPattern);
		}
	});
});
