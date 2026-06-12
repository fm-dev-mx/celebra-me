import { InvitationContentDraftContentSchema } from '@/lib/intake/schemas/invitation-content-draft.schema';

describe('InvitationContentDraftContentSchema — thankYou overlay fields', () => {
	it('preserves thankYou.focalPoint when present', () => {
		const input = {
			thankYou: {
				message: 'Gracias a todos',
				closingName: 'Ana Sofia',
				focalPoint: '50% 42%',
			},
		};

		const result = InvitationContentDraftContentSchema.parse(input);

		expect(result.thankYou?.focalPoint).toBe('50% 42%');
	});

	it('preserves thankYou.overlayAnchor when present', () => {
		const input = {
			thankYou: {
				message: 'Gracias a todos',
				closingName: 'César Ramses',
				overlayAnchor: 'left',
			},
		};

		const result = InvitationContentDraftContentSchema.parse(input);

		expect(result.thankYou?.overlayAnchor).toBe('left');
	});

	it('preserves thankYou.overlaySafeArea when present', () => {
		const overlaySafeArea = { x: 0.5, y: 0.31, width: 0.21, height: 0.24 };
		const input = {
			thankYou: {
				message: 'Gracias a todos',
				closingName: 'César Ramses',
				overlaySafeArea,
			},
		};

		const result = InvitationContentDraftContentSchema.parse(input);

		expect(result.thankYou?.overlaySafeArea).toEqual(overlaySafeArea);
	});

	it('preserves all three thankYou overlay fields together', () => {
		const overlaySafeArea = { x: 0.5, y: 0.31, width: 0.21, height: 0.24 };
		const input = {
			thankYou: {
				message: 'Gracias a todos',
				closingName: 'César Ramses',
				focalPoint: '50% 42%',
				overlayAnchor: 'left',
				overlaySafeArea,
			},
		};

		const result = InvitationContentDraftContentSchema.parse(input);

		expect(result.thankYou).toMatchObject({
			focalPoint: '50% 42%',
			overlayAnchor: 'left',
			overlaySafeArea,
		});
	});

	it('allows thankYou without any overlay fields (backward compatibility)', () => {
		const input = {
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
			},
		};

		const result = InvitationContentDraftContentSchema.parse(input);

		expect(result.thankYou).toMatchObject({
			message: 'Gracias',
			closingName: 'Familia',
		});
		expect(result.thankYou).not.toHaveProperty('focalPoint');
		expect(result.thankYou).not.toHaveProperty('overlayAnchor');
		expect(result.thankYou).not.toHaveProperty('overlaySafeArea');
	});

	it('rejects invalid overlayAnchor values', () => {
		const input = {
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
				overlayAnchor: 'center',
			},
		};

		const result = InvitationContentDraftContentSchema.safeParse(input);

		expect(result.success).toBe(false);
	});

	it('rejects overlaySafeArea with x + width exceeding 1', () => {
		const input = {
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
				overlaySafeArea: { x: 0.9, y: 0.3, width: 0.2, height: 0.2 },
			},
		};

		const result = InvitationContentDraftContentSchema.safeParse(input);

		expect(result.success).toBe(false);
	});
});
