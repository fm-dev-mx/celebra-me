import { describe, expect, it, jest } from '@jest/globals';
import { verifyPersistentLocalTarget } from '../../scripts/db/migrate-policy-local.ts';
import { classifyDbTarget } from '../../scripts/db/db-guard.ts';

describe('persistent-local migrate safety guards', () => {
	it('rejects remote, Preview, Production, or pooler URLs', () => {
		const previewUrl =
			'postgresql://postgres:pass@db.example-preview.supabase.co:5432/postgres';
		const prodUrl =
			'postgresql://postgres:pass@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres';
		const poolerUrl =
			'postgresql://postgres:pass@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

		expect(classifyDbTarget(previewUrl).target).not.toBe('persistent-local');
		expect(classifyDbTarget(prodUrl).target).toBe('production');
		expect(classifyDbTarget(poolerUrl).target).not.toBe('persistent-local');
	});

	it('verifyPersistentLocalTarget throws exit when target is not persistent-local', () => {
		const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});
		const spyExit = jest.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('process.exit called');
		}) as unknown as (code?: string | number | boolean | null) => never);

		const remoteUrl = 'postgresql://postgres:pass@db.example-preview.supabase.co:5432/postgres';

		expect(() => verifyPersistentLocalTarget(remoteUrl)).toThrow('process.exit called');
		expect(spyError).toHaveBeenCalledWith(
			expect.stringContaining(
				'Target database is evaluated as "unknown" instead of persistent-local',
			),
		);

		spyError.mockRestore();
		spyExit.mockRestore();
	});
});
