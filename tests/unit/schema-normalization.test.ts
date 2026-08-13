/**
 * Schema Normalization Tests
 *
 * Verifies normalizeDef in schema-object-contract.ts (used by db:*:audit).
 */

import { normalizeDef } from '../../scripts/db/schema-object-contract.ts';

describe('normalizeDef — auth prefix normalization (positive equivalence)', () => {
	it('normalizes auth.uid() to uid()', () => {
		const a = normalizeDef('(auth.uid() = owner_id)', 'policy_name');
		const b = normalizeDef('(uid() = owner_id)', 'policy_name');
		expect(a).toBe(b);
	});

	it('normalizes hosted auth.users FK qualification to disposable users', () => {
		const a = normalizeDef(
			'FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
			'events_owner_user_id_fkey',
		);
		const b = normalizeDef(
			'FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE',
			'events_owner_user_id_fkey',
		);
		expect(a).toBe(b);
	});

	it('normalizes auth.jwt() to jwt()', () => {
		const a = normalizeDef("(auth.jwt() ->> 'role' = 'admin')", 'policy_name');
		const b = normalizeDef("(jwt() ->> 'role' = 'admin')", 'policy_name');
		expect(a).toBe(b);
	});

	it('normalizes auth.role() to role()', () => {
		const a = normalizeDef('(auth.role() = \'authenticated\')', 'policy_name');
		const b = normalizeDef('(role() = \'authenticated\')', 'policy_name');
		expect(a).toBe(b);
	});

	it('normalizes whitespace differences', () => {
		const a = normalizeDef('(  auth.uid()   =   owner_id  )', 'p');
		const b = normalizeDef('(auth.uid() = owner_id)', 'p');
		expect(a).toBe(b);
	});

	it('normalizes ::text casts', () => {
		const a = normalizeDef('(owner_id::text = auth.uid()::text)', 'p');
		const b = normalizeDef('(owner_id = uid())', 'p');
		expect(a).toBe(b);
	});

	it('replaces the policy name placeholder for self-referencing expressions', () => {
		const a = normalizeDef('SELECT my_policy FROM x WHERE my_policy > 0', 'my_policy');
		expect(a).toContain('NAME_PLACEHOLDER');
		expect(a).not.toContain('my_policy');
	});

	it('handles combined auth.uid and auth.role in one expression', () => {
		const a = normalizeDef(
			"(auth.uid() = owner_id AND auth.role() = 'authenticated')",
			'my_policy'
		);
		const b = normalizeDef(
			"(uid() = owner_id AND role() = 'authenticated')",
			'my_policy'
		);
		expect(a).toBe(b);
	});
});

describe('normalizeDef — negative tests (genuine differences are NOT masked)', () => {
	it('does NOT normalize different column names to be equivalent', () => {
		const a = normalizeDef('(owner_id = auth.uid())', 'p');
		const b = normalizeDef('(user_id = auth.uid())', 'p');
		expect(a).not.toBe(b);
	});

	it('does NOT normalize different logical operators to be equivalent', () => {
		const a = normalizeDef('(auth.uid() = owner_id AND status = \'active\')', 'p');
		const b = normalizeDef('(auth.uid() = owner_id OR status = \'active\')', 'p');
		expect(a).not.toBe(b);
	});

	it('does NOT normalize different comparison operators to be equivalent', () => {
		const a = normalizeDef('(count > 5)', 'p');
		const b = normalizeDef('(count < 5)', 'p');
		expect(a).not.toBe(b);
	});

	it('does NOT normalize IS NULL vs IS NOT NULL to be equivalent', () => {
		const a = normalizeDef('(deleted_at IS NULL)', 'p');
		const b = normalizeDef('(deleted_at IS NOT NULL)', 'p');
		expect(a).not.toBe(b);
	});

	it('does NOT normalize different table names to be equivalent', () => {
		const a = normalizeDef('(EXISTS (SELECT 1 FROM events WHERE owner_id = auth.uid()))', 'p');
		const b = normalizeDef('(EXISTS (SELECT 1 FROM invitations WHERE owner_id = auth.uid()))', 'p');
		expect(a).not.toBe(b);
	});

	it('does NOT normalize different role values to be equivalent', () => {
		const a = normalizeDef("(auth.role() = 'authenticated')", 'p');
		const b = normalizeDef("(auth.role() = 'service_role')", 'p');
		expect(a).not.toBe(b);
	});

	it('does NOT equate an admin check to a non-admin check', () => {
		const adminCheck = normalizeDef('public.is_admin_user()', 'p');
		const regularCheck = normalizeDef('(auth.uid() = owner_id)', 'p');
		expect(adminCheck).not.toBe(regularCheck);
	});
});
