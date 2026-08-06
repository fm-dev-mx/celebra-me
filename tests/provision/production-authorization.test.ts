/**
 * Production owner-gate behavioral coverage + mutator discovery/ordering.
 *
 * Discovers every requireOwnerProductionApply caller under scripts/ (all .ts files),
 * compares against the approved mutator registry, and proves gate-before-first-write
 * ordering. Permanent families: schema migrate, managed promote, SQL patch.
 * Temporary one-offs remain registered until retired (e.g. romina-draft-reset).
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	assertExactProductionProjectRef,
	buildOwnerConfirmationCode,
	requireOwnerProductionApply,
	sanitizeOwnerConfirmationInput,
	shortBindingHex,
} from '../../scripts/db/owner-production-apply.ts';

const ROOT = process.cwd();
const originalEnv = { ...process.env };
const PROD_URL = `postgresql://postgres:secret@db.${SUPABASE_PROJECT_REFS.production}.supabase.co:5432/postgres`;
const PREVIEW_URL = `postgresql://postgres:secret@db.${SUPABASE_PROJECT_REFS.preview}.supabase.co:5432/postgres`;

interface MutatorSpec {
	file: string;
	/** First Production write marker after owner confirmation. */
	firstWritePattern: RegExp;
	/** Optional earlier markers that must remain before the gate (preflight). */
	preflightPatterns?: RegExp[];
	/** permanent | pending one-off awaiting Goal 4 retirement */
	family: 'schema_migration' | 'managed_promotion' | 'sql_patch' | 'pending_one_off';
}

/** Approved Production mutators. Discovery must match this set exactly. */
const APPROVED_MUTATORS: MutatorSpec[] = [
	{
		file: 'scripts/db/migrate-policy-production.ts',
		firstWritePattern: /runCommand\(\s*'supabase',\s*\[[^\]]*['"]--yes['"]/,
		preflightPatterns: [
			/audit-db\.ts/,
			/assertValidReleaseCheckEvidence/,
			/daily-critical-production-backup/,
		],
		family: 'schema_migration',
	},
	{
		file: 'scripts/db/run-prod-patch.ts',
		firstWritePattern: /runPsql\(\s*fullSql/,
		preflightPatterns: [/lintProductionPatchSql/, /assertSameSupabaseProject/],
		family: 'sql_patch',
	},
	{
		file: 'scripts/provision/invitation-promote-cli.ts',
		firstWritePattern: /runPromotionApply\s*\(/,
		preflightPatterns: [/runPromotionPreflight/],
		family: 'managed_promotion',
	},
	{
		file: 'scripts/provision/romina-draft-reset-cli.ts',
		firstWritePattern: /applyRominaDraftReset\s*\(/,
		preflightPatterns: [/evaluatePromotionBackupGate/, /BACKUP_REQUIRED/],
		family: 'pending_one_off',
	},
];

function toPosix(path: string): string {
	return path.replace(/\\/g, '/');
}

function walkTsFiles(dir: string): string[] {
	const absolute = resolve(ROOT, dir);
	if (!existsSync(absolute)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(absolute)) {
		const full = join(absolute, entry);
		const st = statSync(full);
		if (st.isDirectory()) {
			out.push(...walkTsFiles(toPosix(relative(ROOT, full))));
			continue;
		}
		if (entry.endsWith('.ts')) out.push(toPosix(relative(ROOT, full)));
	}
	return out;
}

function discoverRequireOwnerProductionApplyCallers(): string[] {
	return walkTsFiles('scripts')
		.filter((file) => file !== 'scripts/db/owner-production-apply.ts')
		.filter((file) => {
			const source = readFileSync(resolve(ROOT, file), 'utf8');
			return /requireOwnerProductionApply\s*\(/.test(source);
		})
		.sort();
}

function sourceOf(relativePath: string): string {
	return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function indexOfPattern(source: string, pattern: RegExp): number {
	const match = pattern.exec(source);
	if (!match) return -1;
	return match.index;
}

function mockExit(): void {
	jest.spyOn(console, 'error').mockImplementation(() => undefined);
	jest.spyOn(console, 'info').mockImplementation(() => undefined);
	jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
	jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
		throw new Error(`process.exit:${code ?? ''}`);
	}) as never);
}

const baseApplyInput = {
	apply: true as const,
	dbUrl: PROD_URL,
	operationType: 'production_migration',
	operationVerb: 'MIGRATE',
	bindingHex: 'abcdef0123456789deadbeef',
	applyActionLabel: 'Aplicar migración de schema',
	summary: [['Mode', 'test']] as const,
	assertReleaseEvidence: () => ({ sha: 'abc1234' }),
	selectIntent: () => 'proceed' as const,
};

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) delete process.env[key];
	}
	Object.assign(process.env, originalEnv);
	jest.restoreAllMocks();
});

describe('owner confirmation helpers', () => {
	it('builds a short verb + 8-hex confirmation code', () => {
		expect(shortBindingHex('ABCDEF0123456789')).toBe('abcdef01');
		expect(buildOwnerConfirmationCode('MIGRATE', '6774a9459a2a0626')).toBe('MIGRATE 6774a945');
	});

	it('strips bracketed-paste and zero-width noise from typed input', () => {
		expect(sanitizeOwnerConfirmationInput('\u001b[200~MIGRATE 6774a945\u001b[201~\n')).toBe(
			'MIGRATE 6774a945',
		);
		expect(sanitizeOwnerConfirmationInput('  MIGRATE\u200b 6774a945  ')).toBe(
			'MIGRATE 6774a945',
		);
	});
});

describe('requireOwnerProductionApply', () => {
	it('fails without --apply', async () => {
		mockExit();
		await expect(
			requireOwnerProductionApply({
				...baseApplyInput,
				apply: false,
				readConfirmationLine: () => 'MIGRATE abcdef01',
			}),
		).rejects.toThrow('process.exit:1');
	});

	it('rejects agent contexts', async () => {
		mockExit();
		await expect(
			requireOwnerProductionApply({
				...baseApplyInput,
				env: { CELEBRA_AGENT_CONTEXT: 'true' },
				readConfirmationLine: () => 'MIGRATE abcdef01',
			}),
		).rejects.toThrow('process.exit:1');
	});

	it('rejects non-Production project URLs', () => {
		mockExit();
		expect(() => assertExactProductionProjectRef(PREVIEW_URL)).toThrow('process.exit:1');
	});

	it('fails closed without TTY when no confirmation seam is provided', async () => {
		mockExit();
		const fakeStdin = { isTTY: false } as NodeJS.ReadStream;
		await expect(
			requireOwnerProductionApply({
				...baseApplyInput,
				stdin: fakeStdin,
				selectIntent: undefined,
			}),
		).rejects.toThrow('process.exit:1');
	});

	it('fails when intent is cancelled', async () => {
		mockExit();
		await expect(
			requireOwnerProductionApply({
				...baseApplyInput,
				selectIntent: () => 'cancel',
				readConfirmationLine: () => 'MIGRATE abcdef01',
			}),
		).rejects.toThrow('process.exit:1');
	});

	it('fails when typed confirmation does not match', async () => {
		mockExit();
		await expect(
			requireOwnerProductionApply({
				...baseApplyInput,
				readConfirmationLine: () => 'MIGRATE wrongxxx',
			}),
		).rejects.toThrow('process.exit:1');
	});

	it('accepts short confirmation code after identity and release evidence', async () => {
		jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
		await expect(
			requireOwnerProductionApply({
				...baseApplyInput,
				readConfirmationLine: () => 'MIGRATE abcdef01',
			}),
		).resolves.toBeUndefined();
	});

	it('accepts pasted short codes wrapped in bracketed-paste sequences', async () => {
		jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
		await expect(
			requireOwnerProductionApply({
				...baseApplyInput,
				readConfirmationLine: () => '\u001b[200~MIGRATE abcdef01\u001b[201~',
			}),
		).resolves.toBeUndefined();
	});

	it('keeps owner prompts off stdout for machine-readable callers', async () => {
		const stdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
		const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

		await requireOwnerProductionApply({
			...baseApplyInput,
			readConfirmationLine: () => 'MIGRATE abcdef01',
		});

		expect(stdoutWrite).not.toHaveBeenCalled();
		expect(stderrWrite).toHaveBeenCalled();
	});
});

describe('Production mutator discovery and gate ordering', () => {
	it('matches discovered requireOwnerProductionApply callers to the approved registry', () => {
		const discovered = discoverRequireOwnerProductionApplyCallers();
		const approved = APPROVED_MUTATORS.map((m) => m.file).sort();
		expect(discovered).toEqual(approved);
	});

	it('wires each approved mutator to requireOwnerProductionApply without legacy crypto auth', () => {
		for (const mutator of APPROVED_MUTATORS) {
			const source = sourceOf(mutator.file);
			expect(source).toContain('requireOwnerProductionApply');
			expect(source).not.toContain('consumeProductionApproval');
			expect(source).not.toContain('CELEBRA_PROD_APPROVAL_TOKEN');
			expect(source).not.toContain('production_authorization_receipts');
			expect(source).toContain('operationVerb');
			expect(source).toContain('bindingHex');
		}
	});

	it('does not export Ed25519 approval helpers from db-workflow-lib', async () => {
		const lib = await import('../../scripts/db/db-workflow-lib.ts');
		expect('verifyProductionApprovalToken' in lib).toBe(false);
		expect('consumeProductionApproval' in lib).toBe(false);
		expect('requireProductionConfirmation' in lib).toBe(false);
		expect('confirmProductionAction' in lib).toBe(false);
		expect('deriveProductionOperationId' in lib).toBe(false);
	});

	for (const mutator of APPROVED_MUTATORS) {
		it(`${mutator.file}: one gate precedes first write and follows preflight`, () => {
			const source = sourceOf(mutator.file);
			const gateCount = (source.match(/requireOwnerProductionApply\s*\(/g) ?? []).length;
			expect(gateCount).toBe(1);

			const gateIndex = indexOfPattern(source, /requireOwnerProductionApply\s*\(/);
			const writeIndex = indexOfPattern(source, mutator.firstWritePattern);

			expect(gateIndex).toBeGreaterThanOrEqual(0);
			expect(writeIndex).toBeGreaterThanOrEqual(0);
			expect(gateIndex).toBeLessThan(writeIndex);

			for (const preflight of mutator.preflightPatterns ?? []) {
				const preflightIndex = indexOfPattern(source, preflight);
				expect(preflightIndex).toBeGreaterThanOrEqual(0);
				expect(preflightIndex).toBeLessThan(gateIndex);
			}
		});
	}
});
