import { describe, expect, it } from '@jest/globals';
import {
	diffContractConstraints,
	diffContractIndexes,
	diffContractRoutines,
	toContractRoutines,
} from '../../scripts/db/schema-object-contract.ts';

const CANONICAL_INDEX = {
	tableName: 'guest_invitations',
	indexName: 'idx_guest_invitations_phone',
	indexDef: 'CREATE INDEX idx_guest_invitations_phone ON public.guest_invitations USING btree (phone)',
};

const E164_INDEX = {
	tableName: 'guest_invitations',
	indexName: 'idx_guest_invitations_phone_e164',
	indexDef:
		'CREATE INDEX idx_guest_invitations_phone_e164 ON public.guest_invitations USING btree (phone)',
};

const PAIR_CHECK = {
	tableName: 'guest_invitations',
	constraintName: 'guest_invitations_phone_country_code_pair_check',
	constraintType: 'CHECK',
	definition:
		'CHECK ((((phone IS NULL) AND (country_code IS NULL)) OR ((phone IS NOT NULL) AND (country_code IS NOT NULL))))',
};

describe('schema object contract — production regressions', () => {
	it('fails CURRENT-equivalent comparison when the canonical phone index is missing', () => {
		const findings = diffContractIndexes([CANONICAL_INDEX], []);
		expect(findings.some((item) => item.kind === 'missing_expected')).toBe(true);
	});

	it('flags the confirmed Production e164 index as a noncanonical contractual name', () => {
		const findings = diffContractIndexes([CANONICAL_INDEX], [E164_INDEX]);
		expect(findings).toEqual([
			expect.objectContaining({
				kind: 'noncanonical_name',
				expectedName: 'idx_guest_invitations_phone',
				actualName: 'idx_guest_invitations_phone_e164',
			}),
		]);
	});

	it('fails when the canonical index name exists with an incompatible definition', () => {
		const findings = diffContractIndexes(
			[CANONICAL_INDEX],
			[
				{
					...CANONICAL_INDEX,
					indexDef:
						'CREATE UNIQUE INDEX idx_guest_invitations_phone ON public.guest_invitations USING btree (event_id)',
				},
			],
		);
		expect(findings.some((item) => item.kind === 'incompatible_definition')).toBe(true);
	});

	it('fails when the canonical pair CHECK is missing', () => {
		const findings = diffContractConstraints([PAIR_CHECK], []);
		expect(findings.some((item) => item.kind === 'missing_expected')).toBe(true);
	});

	it('fails when the pair CHECK expression is incompatible', () => {
		const findings = diffContractConstraints(
			[PAIR_CHECK],
			[
				{
					...PAIR_CHECK,
					definition: 'CHECK ((phone IS NOT NULL))',
				},
			],
		);
		expect(findings.some((item) => item.kind === 'incompatible_definition')).toBe(true);
	});

	it('fails on a relevant unexpected index', () => {
		const findings = diffContractIndexes(
			[CANONICAL_INDEX],
			[
				CANONICAL_INDEX,
				{
					tableName: 'guest_invitations',
					indexName: 'idx_guest_invitations_phone_extra',
					indexDef:
						'CREATE INDEX idx_guest_invitations_phone_extra ON public.guest_invitations USING btree (country_code)',
				},
			],
		);
		expect(findings.some((item) => item.kind === 'unexpected')).toBe(true);
	});

	it('fails on relevant routine-definition drift', () => {
		const expected = {
			routineName: 'submit_guest_rsvp_public',
			routineType: 'FUNCTION',
			identityArgs: 'text, uuid',
			definition: 'CREATE FUNCTION submit_guest_rsvp_public() ... body-a',
		};
		const findings = diffContractRoutines(
			[expected],
			[{ ...expected, definition: 'CREATE FUNCTION submit_guest_rsvp_public() ... body-b' }],
		);
		expect(findings.some((item) => item.kind === 'incompatible_definition')).toBe(true);
	});

	it('excludes historical backfill helpers from the application routine contract', () => {
		expect(
			toContractRoutines([
				{
					routineName: 'backfill_guest_invitations_from_legacy',
					routineType: 'FUNCTION',
					identityArgs: '',
					definition: 'CREATE FUNCTION backfill_guest_invitations_from_legacy() ...',
				},
				{
					routineName: 'submit_guest_rsvp_public',
					routineType: 'FUNCTION',
					identityArgs: 'text, uuid',
					definition: 'CREATE FUNCTION submit_guest_rsvp_public() ...',
				},
			]).map((item) => item.routineName),
		).toEqual(['submit_guest_rsvp_public']);
	});

	it('is clean when history-aligned objects match including the pair CHECK', () => {
		expect(
			diffContractIndexes([CANONICAL_INDEX], [CANONICAL_INDEX]),
		).toEqual([]);
		expect(diffContractConstraints([PAIR_CHECK], [PAIR_CHECK])).toEqual([]);
	});

	it('does not treat hosted auth.users FK qualification as incompatible with disposable users', () => {
		const hosted = {
			tableName: 'events',
			constraintName: 'events_owner_user_id_fkey',
			constraintType: 'FOREIGN KEY',
			definition: 'FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
		};
		const disposable = {
			...hosted,
			definition: 'FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE',
		};
		expect(diffContractConstraints([disposable], [hosted])).toEqual([]);
	});

	it('still fails when an FK ON DELETE action differs', () => {
		const expected = {
			tableName: 'events',
			constraintName: 'events_owner_user_id_fkey',
			constraintType: 'FOREIGN KEY',
			definition: 'FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE',
		};
		const findings = diffContractConstraints(
			[expected],
			[{ ...expected, definition: 'FOREIGN KEY (owner_user_id) REFERENCES users(id)' }],
		);
		expect(findings.some((item) => item.kind === 'incompatible_definition')).toBe(true);
	});
});
