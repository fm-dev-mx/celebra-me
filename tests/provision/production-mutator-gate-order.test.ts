/**
 * Gate-before-write ordering for all seven Production mutators.
 *
 * Proves requireOwnerProductionApply appears exactly once in the apply path and
 * precedes the first write call site. Legacy authorization tokens remain absent.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';

const ROOT = process.cwd();

interface MutatorSpec {
	file: string;
	/** First Production write marker after owner confirmation. */
	firstWritePattern: RegExp;
	/** Optional earlier markers that must remain before the gate (preflight). */
	preflightPatterns?: RegExp[];
}

const MUTATORS: MutatorSpec[] = [
	{
		file: 'scripts/db/push-prod-migrations.ts',
		// Apply write uses --yes; the earlier dry-run push must not count.
		firstWritePattern: /runCommand\(\s*'supabase',\s*\[[^\]]*['"]--yes['"]/,
		preflightPatterns: [
			/audit-db\.ts/,
			/assertValidReleaseCheckEvidence/,
			/daily-critical-production-backup/,
		],
	},
	{
		file: 'scripts/db/run-prod-patch.ts',
		firstWritePattern: /runPsql\(\s*fullSql/,
		preflightPatterns: [/lintProductionPatchSql/, /assertSameSupabaseProject/],
	},
	{
		file: 'scripts/provision/invitation-promote-cli.ts',
		firstWritePattern: /runPromotionApply\s*\(/,
		preflightPatterns: [/runPromotionPreflight/],
	},
	{
		file: 'scripts/provision/romina-schema-repair-cli.ts',
		firstWritePattern: /applyRominaSchemaRepair\s*\(/,
		preflightPatterns: [/evaluatePromotionBackupGate/, /BACKUP_REQUIRED/],
	},
	{
		file: 'scripts/provision/romina-draft-reset-cli.ts',
		firstWritePattern: /applyRominaDraftReset\s*\(/,
		preflightPatterns: [/evaluatePromotionBackupGate/, /BACKUP_REQUIRED/],
	},
	{
		file: 'scripts/provision/legacy-baseline-adoption-cli.ts',
		firstWritePattern: /applyLegacyBaselineAdoption\s*\(/,
		preflightPatterns: [/evaluatePromotionBackupGate/, /BACKUP_REQUIRED/],
	},
	{
		file: 'scripts/provision/invitation-update-cli.ts',
		// Plan call is read-only; the apply write is the `applied =` invocation after the gate.
		firstWritePattern: /const applied = await runProductionLegacyAdoption\s*\(/,
		preflightPatterns: [/adoption-apply/, /const planned = await runProductionLegacyAdoption/],
	},
];

function sourceOf(relativePath: string): string {
	return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function indexOfPattern(source: string, pattern: RegExp): number {
	const match = pattern.exec(source);
	if (!match) return -1;
	return match.index;
}

describe('Production mutator gate-before-write ordering', () => {
	it('covers exactly the seven requireOwnerProductionApply callers', () => {
		expect(MUTATORS).toHaveLength(7);
		for (const mutator of MUTATORS) {
			const source = sourceOf(mutator.file);
			const gateCount = (source.match(/requireOwnerProductionApply\s*\(/g) ?? []).length;
			expect(gateCount).toBe(1);
		}
	});

	for (const mutator of MUTATORS) {
		it(`${mutator.file}: owner gate precedes first write and follows preflight`, () => {
			const source = sourceOf(mutator.file);
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

			expect(source).not.toContain('consumeProductionApproval');
			expect(source).not.toContain('CELEBRA_PROD_APPROVAL_TOKEN');
			expect(source).not.toContain('production_authorization_receipts');
			expect(source).toContain('requireOwnerProductionApply');
		});
	}
});
