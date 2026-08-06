/**
 * Behavioral content-apply orchestration — plan/apply sequencing and schema gate.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockApplyLocal = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRunImportEngine = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRunPreviewApply = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('../../scripts/provision/apply-local-invitation.ts', () => ({
	applyLocalInvitation: (...args: unknown[]) => mockApplyLocal(...args),
}));

jest.mock('../../scripts/provision/invitation-import-engine.ts', () => ({
	runImportEngine: (...args: unknown[]) => mockRunImportEngine(...args),
}));

jest.mock('../../scripts/provision/preview-apply.ts', () => ({
	runPreviewApply: (...args: unknown[]) => mockRunPreviewApply(...args),
}));

describe('invitation-content-apply behavioral sequencing', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('dry-runs local content without applying', async () => {
		mockApplyLocal.mockResolvedValueOnce({
			plan: { planId: 'local-plan-1' },
			applied: false,
		});
		const { planAndApplyLocalContent } =
			await import('../../scripts/provision/invitation-content-apply.ts');
		const result = await planAndApplyLocalContent({ slug: 'demo', apply: false });
		expect(result).toMatchObject({ plan: { planId: 'local-plan-1' } });
		expect(mockApplyLocal).toHaveBeenCalledTimes(1);
		expect(mockApplyLocal).toHaveBeenCalledWith(
			expect.objectContaining({ slug: 'demo', apply: false }),
		);
	});

	it('applies local content using the dry-run plan', async () => {
		mockApplyLocal
			.mockResolvedValueOnce({ plan: { planId: 'local-plan-2' }, applied: false })
			.mockResolvedValueOnce({ plan: { planId: 'local-plan-2' }, applied: true });
		const { planAndApplyLocalContent } =
			await import('../../scripts/provision/invitation-content-apply.ts');
		const result = await planAndApplyLocalContent({ slug: 'demo', apply: true });
		expect(mockApplyLocal).toHaveBeenCalledTimes(2);
		expect(mockApplyLocal.mock.calls[1]?.[0]).toEqual(
			expect.objectContaining({
				apply: true,
				plan: { planId: 'local-plan-2' },
			}),
		);
		expect(result).toMatchObject({ applied: true });
	});

	it('preview apply dry-runs then applies reviewed plan', async () => {
		const packageData = {
			invitation: { slug: 'demo', eventType: 'boda' },
			packageHash: 'hash',
		};
		mockRunImportEngine.mockResolvedValueOnce({
			plan: { planId: 'preview-plan-1' },
			dryRun: true,
		});
		mockRunPreviewApply.mockResolvedValueOnce({
			plan: { planId: 'preview-plan-1' },
			applied: true,
		});
		const { planAndApplyPreviewContent } =
			await import('../../scripts/provision/invitation-content-apply.ts');
		const result = await planAndApplyPreviewContent({
			packageData: packageData as never,
			targetDbUrl: 'postgresql://postgres:secret@db.preview.supabase.co:5432/postgres',
			apply: true,
		});
		expect(mockRunImportEngine).toHaveBeenCalledWith(
			expect.objectContaining({ dryRun: true, target: 'preview' }),
		);
		expect(mockRunPreviewApply).toHaveBeenCalledWith(
			expect.objectContaining({
				plan: { planId: 'preview-plan-1' },
			}),
		);
		expect(result).toMatchObject({ applied: true });
	});

	it('blocks non-CURRENT schema without invoking apply engines', async () => {
		const { assertContentSchemaCurrent } =
			await import('../../scripts/provision/invitation-content-apply.ts');
		expect(() =>
			assertContentSchemaCurrent({
				target: 'preview',
				schemaLifecycle: 'UNVERIFIED',
			}),
		).toThrow(/SCHEMA_INCOMPATIBLE/);
		expect(() =>
			assertContentSchemaCurrent({
				target: 'local',
				schemaLifecycle: 'SCHEMA_DRIFT',
			}),
		).toThrow(/SCHEMA_INCOMPATIBLE/);
		expect(mockApplyLocal).not.toHaveBeenCalled();
		expect(mockRunPreviewApply).not.toHaveBeenCalled();
	});
});
