import { InvitationEditorSectionSchemas } from '@/lib/intake/schemas/invitation-editor.schema';

const DESKTOP_ASSET_ID = '550e8400-e29b-41d4-a716-446655440001';
const MOBILE_ASSET_ID = '550e8400-e29b-41d4-a716-446655440002';
const THANK_YOU_ASSET_ID = '550e8400-e29b-41d4-a716-446655440003';

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

describe('InvitationEditorSectionSchemas.messages', () => {
	it('preserves thankYou.image when present (uploaded ref)', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({
			quote: { text: 'Una frase', author: 'Autor' },
			thankYou: {
				message: 'Gracias a todos',
				closingName: 'Ana Sofia',
				image: { type: 'uploaded', assetId: THANK_YOU_ASSET_ID },
			},
		});

		expect(result.thankYou).toMatchObject({
			message: 'Gracias a todos',
			closingName: 'Ana Sofia',
			image: { type: 'uploaded', assetId: THANK_YOU_ASSET_ID },
		});
	});

	it('preserves thankYou.image as an internal asset ref', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
				image: { type: 'internal', key: 'thankYouPortrait' },
			},
		});

		expect(result.thankYou?.image).toEqual({
			type: 'internal',
			key: 'thankYouPortrait',
		});
	});

	it('allows thankYou without image', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
			},
		});

		expect(result.thankYou).toMatchObject({
			message: 'Gracias',
			closingName: 'Familia',
		});
		expect(result.thankYou).not.toHaveProperty('image');
	});

	it('allows empty messages object', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({});

		expect(result.quote).toBeUndefined();
		expect(result.thankYou).toBeUndefined();
	});
});
