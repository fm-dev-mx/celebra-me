import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('batched disposable/local migration apply', () => {
	it('applies per-file transactions through one psql file invocation', () => {
		const source = readFileSync('scripts/db/migrate-executors.ts', 'utf8');
		expect(source).toContain('runPsqlFileCommand');
		expect(source).toContain('celebra_migration_ok');
		expect(source).toContain('mkdtempSync');
		expect(source).not.toMatch(/runPsqlCommand\(options\.dbUrl, atomicSql\)/);
	});
});
