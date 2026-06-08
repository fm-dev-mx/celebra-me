import fs from 'node:fs';
import path from 'node:path';

function readMigration(fileName: string): string {
	return fs.readFileSync(path.resolve('supabase/migrations', fileName), 'utf8');
}

function readManualPatch(fileName: string): string {
	return fs.readFileSync(path.resolve('scripts/manual/production-patches', fileName), 'utf8');
}

describe('release migration safety guards', () => {
	it('restores the destructive event slug reconciliation guard to an exception', () => {
		const migration = readMigration('20260402000100_reconcile_event_slug_parity.sql');

		expect(migration).toContain('raise exception');
		expect(migration).not.toContain('raise warning');
	});

	it('rejects impossible HH:mm values before itinerary time updates can run', () => {
		const migration = readMigration('20260608000002_normalize_itinerary_times.sql');

		expect(migration).toContain('PREFLIGHT_ABORT');
		expect(migration).toContain('hours > 23');
		expect(migration).toContain('minutes > 59');
		expect(migration).toContain(
			"jsonb_set(elem, '{time}', to_jsonb(public._normalize_time_str",
		);

		const normalizeFn = migration.slice(
			migration.indexOf('CREATE OR REPLACE FUNCTION public._normalize_time_str'),
			migration.indexOf(
				'$$ LANGUAGE plpgsql IMMUTABLE;',
				migration.indexOf('CREATE OR REPLACE FUNCTION public._normalize_time_str'),
			),
		);
		const lastRaiseIdx = normalizeFn.lastIndexOf('RAISE EXCEPTION');
		const h12Idx = normalizeFn.indexOf('12-hour format');
		expect(lastRaiseIdx).toBeGreaterThan(h12Idx);
	});

	it('normalizes iconName only when a normalizable iconName field already exists', () => {
		const migration = readMigration('20260607000000_normalize_icon_names.sql');

		expect(migration).toContain("WHEN elem ? 'iconName'");
		expect(migration).toContain(
			"public.normalize_icon_name(elem->>'iconName') IS DISTINCT FROM elem->>'iconName'",
		);
		expect(migration).not.toMatch(
			/SELECT jsonb_agg\(\s*jsonb_set\(elem, '\{iconName\}', to_jsonb\(public\.normalize_icon_name\(elem->>'iconName'\)\)\s*\)/,
		);
	});

	it('keeps invitation-specific production patches out of automatic migrations', () => {
		const migrationFiles = fs
			.readdirSync(path.resolve('supabase/migrations'))
			.filter((fileName) => fileName.endsWith('.sql'));

		for (const fileName of migrationFiles) {
			const migration = readMigration(fileName);
			expect(migration).not.toContain('ayrin-samantha-lerma-castro');
		}
	});

	it('does not include the legacy Ayrin backfill as an automatic migration', () => {
		const deletedMigration = path.resolve(
			'supabase/migrations/20260607211553_backfill_legacy_itinerary_icons_and_ayrin_location.sql',
		);
		expect(fs.existsSync(deletedMigration)).toBe(false);
	});

	it('keeps the Ayrin repair as a guarded manual production patch', () => {
		const patch = readManualPatch('20260607211553_backfill_ayrin_location.sql');

		expect(patch).toContain('Manual production patch');
		expect(patch).toContain('production DB backup');
		expect(patch).toContain('expected_invitation_count');
		expect(patch).toContain('expected_invitation_count <> 1');
		expect(patch).toContain('PREFLIGHT_ABORT');
		expect(patch).toContain("invitation.slug = 'ayrin-samantha-lerma-castro'");
		expect(patch).toContain("invitation.base_demo_id = 'demo-xv-enchanted-rose'");
		expect(patch).toContain('Ayrin location image preflight');
		expect(patch).toContain('Ayrin location image verification');
	});
});
