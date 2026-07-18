import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
	resolve(
		process.cwd(),
		'supabase/migrations/20260718145003_configurable_rsvp_attendee_limits.sql',
	),
	'utf8',
);

describe('configurable RSVP attendee limit migration', () => {
	it('removes the former fixed ceiling while retaining relational lower and upper bounds', () => {
		expect(migration).toContain('CHECK (max_allowed_attendees >= 1)');
		expect(migration).toContain(
			'CHECK (attendee_count >= 0 AND attendee_count <= max_allowed_attendees)',
		);
		expect(migration).not.toMatch(/BETWEEN\s+1\s+AND\s+20/i);
		expect(migration).not.toMatch(/BETWEEN\s+0\s+AND\s+20/i);
	});
});
