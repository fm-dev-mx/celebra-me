import { allisonInvitation } from '../../scripts/provision/invitations/allison-scarlett';
import { heroSchema } from '@/lib/schemas/content/hero.schema';
import { envelopeSchema } from '@/lib/schemas/content/envelope.schema';
import { gallerySchema } from '@/lib/schemas/content/gallery.schema';

describe('ceremonial invitation contracts', () => {
	it('keeps typed decorative references separate from live text', () => {
		const hero = {
			name: 'Persona de prueba',
			date: '2026-11-27T18:00:00.000Z',
			variant: 'ceremonial-portrait',
			backgroundImage: '/portrait.webp',
			ornament: { type: 'internal', key: 'sealImage' },
		};
		expect(heroSchema.safeParse(hero).success).toBe(true);
		expect(
			heroSchema.safeParse({ ...hero, ornament: { type: 'unrecognized', key: 'sealImage' } })
				.success,
		).toBe(false);
		expect(
			envelopeSchema.safeParse({
				revealVariant: 'satin-filigree',
				sealImage: { type: 'internal', key: 'sealImage' },
			}).success,
		).toBe(true);
		expect(envelopeSchema.safeParse({ revealVariant: 'unknown-reveal' }).success).toBe(false);
	});

	it('requires exactly two photographs for paired portraits', () => {
		const input = {
			variant: 'paired-portraits',
			items: [{ image: '/a.webp' }, { image: '/b.webp' }],
		};
		expect(gallerySchema.safeParse(input).success).toBe(true);
		expect(gallerySchema.safeParse({ ...input, items: input.items.slice(0, 1) }).success).toBe(
			false,
		);
		expect(
			gallerySchema.safeParse({ ...input, items: [...input.items, { image: '/c.webp' }] })
				.success,
		).toBe(false);
	});

	it('preserves the real countdown instant', () => {
		expect(allisonInvitation.eventTiming).toEqual({
			localDateTime: '2026-11-27T18:00',
			timeZone: 'America/Mexico_City',
			startsAtUtc: '2026-11-28T00:00:00.000Z',
		});
	});

	it('binds purpose-built mobile and desktop hero derivatives', () => {
		const content = allisonInvitation.buildPublishedContent(
			Object.fromEntries(
				allisonInvitation.assets.map((asset) => [
					asset.key,
					{
						type: 'uploaded' as const,
						assetId: asset.key,
						src: `/${asset.relativePath}`,
					},
				]),
			),
		);
		const hero = content.hero as Record<string, unknown>;
		expect(hero.backgroundImageMobile).toMatchObject({ assetId: 'heroMobile' });
		expect(hero.backgroundImageDesktop).toMatchObject({ assetId: 'heroDesktop' });
		expect(hero.focalPointMobile).toBe('50% 36%');
		expect(hero.focalPointDesktop).toBe('52% 32%');
		expect(hero.ornament).toBeUndefined();
		expect(hero.accentOrnament).toBeUndefined();
		expect(content.countdown).toMatchObject({
			ornament: { assetId: 'slipper' },
		});
		expect(content.thankYou).toMatchObject({ image: { assetId: 'closingCarriage' } });
		expect(allisonInvitation.assets).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: 'heroMobile', relativePath: 'hero-mobile.webp' }),
				expect.objectContaining({ key: 'heroDesktop', relativePath: 'hero-desktop.webp' }),
			]),
		);
		expect(allisonInvitation.assets.map((asset) => asset.key)).not.toEqual(
			expect.arrayContaining(['carriage']),
		);
	});
});
