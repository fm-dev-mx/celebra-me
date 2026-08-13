import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('import engine target scan batching', () => {
	it('loads planning evidence with one json_build_object query', () => {
		const source = readFileSync('scripts/provision/invitation-import-engine.ts', 'utf8');
		const scanFn = source.slice(
			source.indexOf('function scanTargetState('),
			source.indexOf('function verifyPostPublication('),
		);
		expect(scanFn).toContain('buildTargetScanSql');
		expect(scanFn.match(/runPsql\(/g)?.length).toBe(1);
		expect(source).toContain('json_build_object(');
		expect(source).toContain("'draft'");
		expect(source).toContain("'pubByInvitation'");
		expect(source).toContain("'appliedReceipt'");
		expect(source).toContain("'latestReceipt'");
		expect(source).toContain("'member'");
	});
});
