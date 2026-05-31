import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
	path.resolve('supabase/migrations/20260601000001_invitations_domain.sql'),
	'utf8',
);

describe('invitations domain migration', () => {
	it('renames the primary table while keeping a rollout compatibility view', () => {
		expect(migration).toContain('alter table public.invitation_projects rename to invitations');
		expect(migration).toContain('create view public.invitation_projects as');
	});

	it('adds invitation kind and source invitation lineage', () => {
		expect(migration).toContain("check (kind in ('demo', 'client'))");
		expect(migration).toContain('source_invitation_id uuid null');
	});

	it('archives RSVP events with client invitations', () => {
		expect(migration).toContain('update public.events');
		expect(migration).toContain("set deleted_at = now(), status = 'archived'");
	});

	it('blocks permanent deletion when RSVP history exists', () => {
		expect(migration).toContain("return 'blocked_rsvp_history'");
		expect(migration).toContain('public.guest_invitations');
		expect(migration).toContain('public.event_claim_codes');
		expect(migration).toContain('public.event_memberships');
	});
});
