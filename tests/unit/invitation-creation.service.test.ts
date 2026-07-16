jest.mock('astro:content', () => ({ getCollection: jest.fn() }));
jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	createInvitation: jest.fn(),
}));
jest.mock('@/lib/intake/demo-preset-catalog', () => ({
	DEMO_PRESET_CATALOG: [],
	findDemoPreset: jest.fn(),
}));

import { createInvitation } from '@/lib/intake/services/invitation.service';
import { createInvitation as createInvitationRecord } from '@/lib/intake/repositories/invitation.repository';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';

const mockCreateRecord = createInvitationRecord as jest.MockedFunction<
	typeof createInvitationRecord
>;
const mockFindPreset = findDemoPreset as jest.MockedFunction<typeof findDemoPreset>;

const preset = {
	id: 'demo-xv-jewelry-box',
	eventType: 'xv' as const,
	displayName: 'XV',
	themeId: 'jewelry-box' as const,
	defaultSections: [],
	supportedBlocks: [],
	recommendedBlocks: [],
	requiredAssets: [],
	previewSlug: 'demo-xv-jewelry-box',
};

beforeEach(() => jest.clearAllMocks());

describe('createInvitation preset invariant', () => {
	it('rejects an event-type mismatch before persistence', async () => {
		mockFindPreset.mockReturnValue(preset);

		await expect(
			createInvitation({ title: 'Boda', eventType: 'boda', baseDemoId: preset.id }),
		).rejects.toMatchObject({
			status: 422,
			code: 'validation_error',
			details: { reason: 'base_demo_event_type_mismatch' },
		});
		expect(mockCreateRecord).not.toHaveBeenCalled();
	});

	it.each([
		['unknown preset', undefined],
		['malformed preset', { ...preset, themeId: '' }],
	])('rejects %s before persistence', async (_label, value) => {
		mockFindPreset.mockReturnValue(value as never);

		await expect(
			createInvitation({ title: 'XV', eventType: 'xv', baseDemoId: preset.id }),
		).rejects.toMatchObject({
			status: 422,
			code: 'validation_error',
			details: { reason: 'invalid_base_demo' },
		});
		expect(mockCreateRecord).not.toHaveBeenCalled();
	});

	it('preserves valid canonical creation', async () => {
		mockFindPreset.mockReturnValue(preset);
		mockCreateRecord.mockResolvedValue({ id: 'inv-1' } as never);

		await expect(
			createInvitation({ title: 'XV', eventType: 'xv', baseDemoId: preset.id }),
		).resolves.toMatchObject({ id: 'inv-1' });
		expect(mockCreateRecord).toHaveBeenCalledWith(
			expect.objectContaining({ eventType: 'xv', themeId: 'jewelry-box', snapshot: preset }),
		);
	});
});
