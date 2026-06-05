import { InvitationEditorSectionSchemas } from '@/lib/intake/schemas/invitation-editor.schema';

const DESKTOP_ASSET_ID = '550e8400-e29b-41d4-a716-446655440001';
const MOBILE_ASSET_ID = '550e8400-e29b-41d4-a716-446655440002';

describe('InvitationEditorSectionSchemas.main', () => {
	it('preserves independent desktop and mobile hero image refs', () => {
		const result = InvitationEditorSectionSchemas.main.parse({
			title: 'XV Ana',
			description: 'Celebremos juntos',
			hero: {
				name: 'Ana',
				backgroundImage: { type: 'uploaded', assetId: DESKTOP_ASSET_ID },
				backgroundImageMobile: { type: 'uploaded', assetId: MOBILE_ASSET_ID },
			},
		});

		expect(result.hero.backgroundImage).toEqual({
			type: 'uploaded',
			assetId: DESKTOP_ASSET_ID,
		});
		expect(result.hero.backgroundImageMobile).toEqual({
			type: 'uploaded',
			assetId: MOBILE_ASSET_ID,
		});
	});

	it('does not create a mobile hero image ref when it is absent', () => {
		const result = InvitationEditorSectionSchemas.main.parse({
			title: 'XV Ana',
			description: 'Celebremos juntos',
			hero: {
				name: 'Ana',
				backgroundImage: { type: 'uploaded', assetId: DESKTOP_ASSET_ID },
			},
		});

		expect(result.hero.backgroundImage).toEqual({
			type: 'uploaded',
			assetId: DESKTOP_ASSET_ID,
		});
		expect(result.hero).not.toHaveProperty('backgroundImageMobile');
	});
});
