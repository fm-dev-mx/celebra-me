import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMigrateCliArgs } from '../../scripts/db/migrate-cli-args.ts';

describe('migrate-cli-args', () => {
	it('parses help without requiring a target', () => {
		const parsed = parseMigrateCliArgs(['node', 'migrate-cli.ts', '--help']);
		expect(parsed.help).toBe(true);
		expect(parsed.target).toBeNull();
	});

	it('defaults to read-only preflight', () => {
		const parsed = parseMigrateCliArgs(['node', 'migrate-cli.ts', '--target', 'preview']);
		expect(parsed.mode).toBe('preflight');
		expect(parsed.json).toBe(false);
	});

	it('keeps help/parse module free of mutation imports', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/migrate-cli-args.ts'),
			'utf8',
		);
		expect(source).not.toMatch(/migrate-orchestrator|migrate-policy|migrate-executors/);
		expect(source).not.toMatch(/supabase|runPsql|requireOwnerProductionApply/);
	});
});
