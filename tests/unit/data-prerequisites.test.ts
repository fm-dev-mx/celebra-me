/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs';
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

// Resolve from this file, never from the working directory: Jest may run from any folder.
const repositoryRoot = resolve(__dirname, '../..');
const committedManifest = readFileSync(resolve(repositoryRoot, DATA_PREREQUISITES_PATH), 'utf8');

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
		const scanRoots = [
			resolve(repositoryRoot, 'src'),
			resolve(repositoryRoot, 'scripts'),
			resolve(repositoryRoot, 'supabase/functions'),
		].filter((dir) => existsSync(dir));
		expect(scanRoots.length).toBeGreaterThan(0);
		const reads = scanAppMetadataKeyReads(scanRoots, repositoryRoot);
		// A scan that finds nothing means the scanner broke, not that the code stopped reading.
		expect(reads.length).toBeGreaterThan(0);
		expect(new Set(reads.map((read) => read.file)).size).toBeGreaterThan(1);
		expect(reads.map((read) => read.key)).toEqual(
			expect.arrayContaining(['login_alias', 'role', 'must_change_password']),
		);
		const undeclared = findUndeclaredAppMetadataKeys(
			reads,
			parseDataPrerequisiteManifest(committedManifest),
		);
		if (undeclared.length > 0) throw new Error(describeUndeclaredAppMetadataKeys(undeclared));
	});

	const patchIds = [
		'20260812-itinerary-gallery-structural-contracts',
		'20260812-thankyou-editorial-back-cover',
		'20260812-guest-invitation-phone-objects',
	];

	it.each(['production', 'preview'])('declares the August patches for %s', (environment) => {
		const parsed = parseDataPrerequisiteManifest(committedManifest);
		for (const id of patchIds) {
			const entry = parsed.prerequisites.find((item) => item.id === id);
			// Evidence may advance to verified/not-applicable without changing this contract test.
			expect(entry?.environments[environment]).toBeDefined();
			expect(entry?.introducedBy).toMatch(/20260812.*\.sql$/u);
			const query = entry?.verify.match(/--file=(\S+)/u)?.[1];
			expect(query).toBeDefined();
			expect(existsSync(resolve(repositoryRoot, query!))).toBe(true);
		}
	});

	it.each(patchIds)('blocks on %s even when every other prerequisite is verified', (id) => {
		const parsed = parseDataPrerequisiteManifest(committedManifest);
		for (const entry of parsed.prerequisites) {
			for (const environment of ['production', 'preview']) {
				entry.environments[environment] = {
					status: 'verified',
					verifiedAt: '2026-11-10',
					evidence: 'Synthetic verification for the release gate test.',
				};
			}
		}
		const verified = JSON.stringify(parsed);
		expect(() => requireDataPrerequisites(verified)).not.toThrow();
		const entry = parsed.prerequisites.find((item) => item.id === id)!;
		entry.environments.production = { status: 'pending' };
		expect(() => requireDataPrerequisites(JSON.stringify(parsed))).toThrow(`- ${id}:`);
		expect(() => requireDataPrerequisites(JSON.stringify(parsed))).toThrow(entry.verify);
		expect(() => requireDataPrerequisites(JSON.stringify(parsed), 'preview')).not.toThrow();
	});

	it('preserves the verified login alias prerequisite independently of pending patches', () => {
		const parsed = parseDataPrerequisiteManifest(committedManifest);
		parsed.prerequisites = parsed.prerequisites.filter(
			(entry) => entry.id === 'auth-login-alias-app-metadata',
		);
		parsed.authAppMetadataKeys = Object.fromEntries(
			Object.entries(parsed.authAppMetadataKeys).filter(
				([, mapping]) =>
					!('prerequisite' in mapping) ||
					mapping.prerequisite === 'auth-login-alias-app-metadata',
			),
		);
		expect(parsed.prerequisites).toHaveLength(1);
		expect(() => requireDataPrerequisites(JSON.stringify(parsed))).not.toThrow();
		expect(() => requireDataPrerequisites(JSON.stringify(parsed), 'preview')).not.toThrow();
	});

	it.each(['production', 'preview'])(
		'blocks %s until role synchronization is verified',
		(environment) => {
			const parsed = parseDataPrerequisiteManifest(committedManifest);
			expect(parsed.authAppMetadataKeys.role).toEqual({
				prerequisite: 'auth-role-app-metadata',
			});
			expect(
				parsed.prerequisites.find(({ id }) => id === 'auth-role-app-metadata')
					?.environments[environment].status,
			).toBe('pending');
			expect(() => requireDataPrerequisites(committedManifest, environment)).toThrow(
				/auth-role-app-metadata: .*`pnpm auth:check-role-app-metadata`/,
			);
		},
	);
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

	it('finds keys accessed through constants with their line', () => {
		const source = [
			"const ROLE_KEY = 'role';",
			"const ALIAS_KEY = 'login_alias' as const;",
			'const a = user.app_metadata[ROLE_KEY];',
			'const b = user.app_metadata?.[ALIAS_KEY];',
			'const { [ROLE_KEY]: r } = user.app_metadata;',
		].join('\n');
		expect(findAppMetadataKeyReads(source, 'example.ts')).toEqual([
			{ key: 'role', file: 'example.ts', line: 3 },
			{ key: 'login_alias', file: 'example.ts', line: 4 },
			{ key: 'role', file: 'example.ts', line: 5 },
		]);
	});

	it('finds keys extracted through destructuring and nested patterns', () => {
		const source = [
			'const { login_alias, role: userRole } = user.app_metadata;',
			'const { must_change_password } = user.app_metadata ?? {};',
			'const { app_metadata: { temp_password_expires_at } } = user;',
			'function authCheck({ app_metadata: { role } }: User) { return role; }',
			'const { app_metadata: meta } = user;',
			'const flag = meta.must_change_password;',
		].join('\n');
		expect(findAppMetadataKeyReads(source, 'example.ts')).toEqual([
			{ key: 'login_alias', file: 'example.ts', line: 1 },
			{ key: 'role', file: 'example.ts', line: 1 },
			{ key: 'must_change_password', file: 'example.ts', line: 2 },
			{ key: 'temp_password_expires_at', file: 'example.ts', line: 3 },
			{ key: 'role', file: 'example.ts', line: 4 },
			{ key: 'must_change_password', file: 'example.ts', line: 6 },
		]);
	});

	it('finds keys accessed inside helpers receiving or returning app_metadata', () => {
		const source = [
			'function isExpired(appMetadata: Record<string, unknown>) {',
			'    return appMetadata.must_change_password;',
			'}',
			'function checkRole(meta: Record<string, unknown>) {',
			'    return meta.role;',
			'}',
			'checkRole(user.app_metadata);',
			'const getMeta = (u: User) => u.app_metadata;',
			'const alias = getMeta(user)?.login_alias;',
		].join('\n');
		expect(findAppMetadataKeyReads(source, 'example.ts')).toEqual([
			{ key: 'must_change_password', file: 'example.ts', line: 2 },
			{ key: 'role', file: 'example.ts', line: 5 },
			{ key: 'login_alias', file: 'example.ts', line: 9 },
		]);
	});

	it('propagates metadata aliases before analyzing helper calls and resolves call chains', () => {
		const source = [
			'function check(meta) {',
			'    return meta.new_flag;',
			'}',
			'const metadata = user.app_metadata;',
			'check(metadata);',
			'function inner(val) {',
			'    return val.temp_flag;',
			'}',
			'function outer(m) {',
			'    return inner(m);',
			'}',
			'outer(metadata);',
		].join('\n');
		expect(findAppMetadataKeyReads(source, 'example.ts')).toEqual([
			{ key: 'new_flag', file: 'example.ts', line: 2 },
			{ key: 'temp_flag', file: 'example.ts', line: 7 },
		]);
	});

	it('resolves constants by symbol and scope, isolating shadowing between functions and top level', () => {
		const source = [
			"const KEY = 'new_flag';",
			'function unrelated() {',
			"    const KEY = 'role';",
			'    return user.app_metadata[KEY];',
			'}',
			'const a = user.app_metadata[KEY];',
		].join('\n');
		expect(findAppMetadataKeyReads(source, 'example.ts')).toEqual([
			{ key: 'role', file: 'example.ts', line: 4 },
			{ key: 'new_flag', file: 'example.ts', line: 6 },
		]);
	});

	it('resolves imported constants with renamed aliases and isolates homonymous exports across modules', () => {
		const source = [
			"import { REAL_KEY as KEY } from './constants';",
			"import { KEY as MODULE_A_KEY } from './module-a';",
			"import { KEY as MODULE_B_KEY } from './module-b';",
			'const a = user.app_metadata[KEY];',
			'const b = user.app_metadata[MODULE_A_KEY];',
			'const c = user.app_metadata[MODULE_B_KEY];',
		].join('\n');
		const externalConstants = {
			'./constants': { REAL_KEY: 'new_flag' },
			'./module-a': { KEY: 'role' },
			'./module-b': { KEY: 'must_change_password' },
		};
		expect(findAppMetadataKeyReads(source, 'example.ts', externalConstants)).toEqual([
			{ key: 'new_flag', file: 'example.ts', line: 4 },
			{ key: 'role', file: 'example.ts', line: 5 },
			{ key: 'must_change_password', file: 'example.ts', line: 6 },
		]);
	});

	it('extracts keys from destructured helper parameters receiving metadata', () => {
		const source = [
			'function check({ new_flag }) {',
			'    return new_flag;',
			'}',
			'check(user.app_metadata);',
			'function checkComplex({ role: userRole, ...rest }) {',
			'    return rest.temp_flag;',
			'}',
			'const meta = user.app_metadata;',
			'checkComplex(meta);',
		].join('\n');
		expect(findAppMetadataKeyReads(source, 'example.ts')).toEqual([
			{ key: 'new_flag', file: 'example.ts', line: 1 },
			{ key: 'role', file: 'example.ts', line: 5 },
			{ key: 'temp_flag', file: 'example.ts', line: 6 },
		]);
	});

	it('treats rest binding elements as remaining metadata aliases, ignoring dotDotDotToken as keys', () => {
		const source = [
			'const { role, ...rest } = user.app_metadata;',
			'const flag = rest.new_flag;',
			'let remainder;',
			'({ must_change_password: mcp, ...remainder } = user.app_metadata);',
			'const alias = remainder.login_alias;',
		].join('\n');
		expect(findAppMetadataKeyReads(source, 'example.ts')).toEqual([
			{ key: 'role', file: 'example.ts', line: 1 },
			{ key: 'new_flag', file: 'example.ts', line: 2 },
			{ key: 'must_change_password', file: 'example.ts', line: 4 },
			{ key: 'login_alias', file: 'example.ts', line: 5 },
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
