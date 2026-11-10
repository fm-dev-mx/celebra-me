/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	DATA_PREREQUISITES_PATH,
	describeUndeclaredAppMetadataKeys,
	findAppMetadataKeyReads,
	findUndeclaredAppMetadataKeys,
	parseDataPrerequisiteManifest,
	requireDataPrerequisites,
	scanAppMetadataKeyReads,
} from '../../scripts/ops/data-prerequisites.ts';

const committedManifest = readFileSync(resolve(DATA_PREREQUISITES_PATH), 'utf8');

const prerequisite = (production: Record<string, unknown> | undefined) => ({
	id: 'example-backfill',
	summary: 'Every account has the example value.',
	introducedBy: 'https://example.test/pull/1',
	verify: 'pnpm example:check',
	environments: production ? { production } : {},
});
const manifest = (
	prerequisites: unknown[],
	authAppMetadataKeys: Record<string, unknown> = {},
): string => JSON.stringify({ version: 1, authAppMetadataKeys, prerequisites });

describe('committed data prerequisite manifest', () => {
	it('declares every app_metadata key that application code reads', () => {
		const reads = scanAppMetadataKeyReads(resolve('src'));
		// A scan that finds nothing means the scanner broke, not that the code stopped reading.
		expect(reads.map((read) => read.key)).toEqual(
			expect.arrayContaining(['login_alias', 'role', 'must_change_password']),
		);
		const undeclared = findUndeclaredAppMetadataKeys(
			reads,
			parseDataPrerequisiteManifest(committedManifest),
		);
		if (undeclared.length > 0) throw new Error(describeUndeclaredAppMetadataKeys(undeclared));
	});

	it('allows a Production release', () => {
		expect(() => requireDataPrerequisites(committedManifest)).not.toThrow();
	});
});

describe('app_metadata key scanner', () => {
	it('finds dotted, optional and bracketed reads with their line', () => {
		const source = [
			'const a = user.app_metadata?.login_alias;',
			'const b = user.app_metadata.role;',
			"const c = user.app_metadata['must_change_password'];",
			'const d = user.app_metadata?.["temp_flag"];',
			'const e = user.user_metadata?.login_alias;',
		].join('\n');
		expect(findAppMetadataKeyReads(source, 'example.ts')).toEqual([
			{ key: 'login_alias', file: 'example.ts', line: 1 },
			{ key: 'role', file: 'example.ts', line: 2 },
			{ key: 'must_change_password', file: 'example.ts', line: 3 },
			{ key: 'temp_flag', file: 'example.ts', line: 4 },
		]);
	});

	it('reports a read that the manifest does not declare, with the way out', () => {
		const reads = findAppMetadataKeyReads('user.app_metadata?.new_flag', 'src/example.ts');
		const undeclared = findUndeclaredAppMetadataKeys(
			reads,
			parseDataPrerequisiteManifest(
				manifest([], { role: { migration: 'none', reason: 'Set by a trigger.' } }),
			),
		);
		expect(undeclared).toEqual([{ key: 'new_flag', file: 'src/example.ts', line: 1 }]);
		const message = describeUndeclaredAppMetadataKeys(undeclared);
		expect(message).toContain('- new_flag (src/example.ts:1)');
		expect(message).toContain('"migration": "none"');
		expect(message).toContain('docs/core/release-process.md');
	});

	it('does not treat an inherited object property as a declaration', () => {
		const reads = findAppMetadataKeyReads('user.app_metadata.constructor', 'src/example.ts');
		expect(
			findUndeclaredAppMetadataKeys(reads, parseDataPrerequisiteManifest(manifest([]))),
		).toHaveLength(1);
	});
});

describe('data prerequisite release gate', () => {
	it('refuses a release SHA without a manifest', () => {
		expect(() => requireDataPrerequisites(null)).toThrow(
			/Data prerequisites are unknown: supabase\/data-prerequisites\.json could not be read/,
		);
	});

	it('passes with no prerequisites, with verified evidence and with not-applicable', () => {
		expect(requireDataPrerequisites(manifest([]))).toEqual([]);
		expect(
			requireDataPrerequisites(
				manifest([
					prerequisite({
						status: 'verified',
						verifiedAt: '2026-11-09',
						evidence: 'Applied in release abc.',
					}),
				]),
			),
		).toHaveLength(1);
		expect(() =>
			requireDataPrerequisites(
				manifest([
					prerequisite({ status: 'not-applicable', evidence: 'No such accounts here.' }),
				]),
			),
		).not.toThrow();
	});

	it.each([
		['pending', prerequisite({ status: 'pending' })],
		['absent for the environment', prerequisite(undefined)],
	])('refuses a prerequisite that is %s and names the verification', (_, entry) => {
		expect(() => requireDataPrerequisites(manifest([entry]))).toThrow(
			/not verified for production; do not activate this release:\n- example-backfill: .*`pnpm example:check`/,
		);
	});

	it('judges each environment on its own', () => {
		const entry = prerequisite({
			status: 'verified',
			verifiedAt: '2026-11-09',
			evidence: 'Applied.',
		});
		Object.assign(entry.environments, { preview: { status: 'pending' } });
		const text = manifest([entry]);
		expect(() => requireDataPrerequisites(text, 'production')).not.toThrow();
		expect(() => requireDataPrerequisites(text, 'preview')).toThrow('not verified for preview');
	});

	it.each([
		['verified without evidence', { status: 'verified', verifiedAt: '2026-11-09' }, 'evidence'],
		['verified without a date', { status: 'verified', evidence: 'Applied.' }, 'verifiedAt'],
		[
			'verified with a malformed date',
			{ status: 'verified', verifiedAt: 'yesterday', evidence: 'Applied.' },
			'verifiedAt',
		],
		['not-applicable without a reason', { status: 'not-applicable' }, 'saying why'],
		['an unknown status', { status: 'done' }, 'status of verified'],
	])('rejects %s', (_, production, detail) => {
		expect(() => requireDataPrerequisites(manifest([prerequisite(production)]))).toThrow(
			new RegExp(`supabase/data-prerequisites\\.json is invalid: .*${detail}`),
		);
	});

	it.each([
		['text that is not JSON', '{'],
		[
			'another version',
			JSON.stringify({ version: 2, authAppMetadataKeys: {}, prerequisites: [] }),
		],
		[
			'a prerequisite without a verify command',
			manifest([{ ...prerequisite(undefined), verify: '' }]),
		],
		['a duplicated id', manifest([prerequisite(undefined), prerequisite(undefined)])],
		[
			'a key naming an unknown prerequisite',
			manifest([], { flag: { prerequisite: 'missing' } }),
		],
		['a key excused without a reason', manifest([], { flag: { migration: 'none' } })],
	])('rejects %s', (_, text) => {
		expect(() => requireDataPrerequisites(text)).toThrow('is invalid');
	});
});
