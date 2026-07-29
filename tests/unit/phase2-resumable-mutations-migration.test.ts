import { readFileSync } from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
	process.cwd(),
	'supabase/migrations/20260729152113_managed_baseline_and_resumable_mutations_phase_2.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('Phase 2 resumable mutation migration', () => {
	it('creates narrow atomic editor RPCs with optimistic preconditions and receipts', () => {
		expect(sql).toContain('create function public.save_invitation_metadata_atomic');
		expect(sql).toContain('create function public.restore_invitation_from_published_atomic');
		expect(sql).toContain('editor_stale_invitation');
		expect(sql).toContain('editor_stale_draft');
		expect(sql).toContain('editor_stale_published');
		expect(sql).toContain('invitation_mutation_operation_receipts');
		expect(sql).toContain("'invitation_metadata_saved', 'draft_reopened'");
		expect(sql).toContain("array['invitation_metadata_restored', 'draft_restored']");
	});

	it('grants execute only to service_role and does not touch RSVP guest tables', () => {
		expect(sql).toContain('to service_role');
		expect(sql).not.toMatch(/\b(?:insert into|update|delete from) public\.guest_/u);
		// The exact grant exists, but never targets anon/authenticated.
		const grants = sql
			.split(/\r?\n/u)
			.filter((line) => line.trim().startsWith('grant execute on function'));
		expect(grants).toHaveLength(2);
		expect(sql).not.toMatch(/grant execute[\s\S]*?to (?:anon|authenticated)/u);
	});
});
