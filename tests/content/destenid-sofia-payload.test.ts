import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import {
	DESTENID_ASSET_SPECS,
	DESTENID_EVENT,
	buildDestenidPublishedContent,
	destenidInvitation,
	type DestenidAssetMap,
} from '../../scripts/provision/invitations/destenid-sofia.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

const PLACEHOLDER_PATTERN =
	/PENDIENTE|\[confirmar|Confirmar ubicación|definir fecha límite|confirmar número de registro|Solicitar enlace de Google Maps|^Por confirmar$|Pendiente de confirmar/i;

function buildTestAssets(): DestenidAssetMap {
	return Object.fromEntries(
		DESTENID_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as DestenidAssetMap;
}

function collectPlaceholderStrings(value: unknown, pathSegments: string[] = []): string[] {
	if (typeof value === 'string') {
		return PLACEHOLDER_PATTERN.test(value) ? [`${pathSegments.join('.')}: ${value}`] : [];
	}

	if (Array.isArray(value)) {
		return value.flatMap((item, index) =>
			collectPlaceholderStrings(item, [...pathSegments, String(index)]),
		);
	}

	if (value && typeof value === 'object') {
		return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
			collectPlaceholderStrings(item, [...pathSegments, key]),
		);
	}

	return [];
}

describe('Destenid Sofía managed definition', () => {
	it('resolves from the managed registry', () => {
		expect(getInvitationDefinition('destenid-sofia')).toBe(destenidInvitation);
		expect(destenidInvitation.hostLoginAlias).toBe('destenid_sofia');
		expect(destenidInvitation.lifecycle).toBe('in_progress');
		expect(destenidInvitation.deliveryScope).toBe('content-and-assets');
	});

	it('uses a consistent editorial-magazine catalog entry', () => {
		const preset = findDemoPreset(DESTENID_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-xv-editorial-magazine',
			eventType: 'xv',
			themeId: 'editorial-magazine',
		});
		expect(
			checkPublishGuard({
				baseDemoId: DESTENID_EVENT.baseDemoId,
				themeId: DESTENID_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('builds schema-valid published content with authored editorial variants', () => {
		const content = buildDestenidPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect({
			success: result.success,
			...(result.success ? {} : { issues: result.error.issues }),
		}).toStrictEqual({ success: true });

		const parsed = eventContentSchema.parse(content);
		expect(parsed.hero.variant).toBe('editorial-cover');
		expect(parsed.countdown?.variant).toBe('magazine-folio');
		expect(parsed.gallery?.variant).toBe('magazine-spread');
		expect(parsed.gallery?.items).toHaveLength(10);
		expect(parsed.itinerary?.variant).toBe('editorial-program');
		expect(parsed.gifts?.variant).toBe('editorial-catalog');
		expect(parsed.rsvp?.variant).toBe('editorial-press-pass');
		expect(parsed.rsvp?.personalizedAccess?.variant).toBe('editorial-pass');
		expect(parsed.thankYou?.variant).toBe('editorial-back-cover');
		expect(parsed.envelope?.revealVariant).toBe('editorial-cover');
		expect(parsed.visualProfileId).toBe('destenid-sofia');
	});

	it('honors the client omissions: reception only, no parents, no godparents', () => {
		const parsed = eventContentSchema.parse(buildDestenidPublishedContent(buildTestAssets()));
		expect(parsed.location?.venues).toHaveLength(1);
		expect(parsed.location?.venues?.[0]?.type).toBe('reception');
		expect(parsed.family?.parents).toBeUndefined();
		expect(parsed.family?.godparents).toBeUndefined();
		expect(parsed.family?.godparentGroups).toBeUndefined();
		// Envelopes always; the transfer card appears once the owner fills in the card number.
		const giftTypes = parsed.gifts?.items?.map((item) => item.type) ?? [];
		expect(giftTypes[0]).toBe('cash');
		expect(giftTypes.every((type) => type === 'cash' || type === 'bank')).toBe(true);
		const transfer = parsed.gifts?.items?.find((item) => item.type === 'bank');
		if (transfer && transfer.type === 'bank') {
			expect(transfer.bankName).toBe('BBVA');
			expect(transfer.accountHolder).toBe('Destenid Sofía Magaña Almaraz');
			expect(transfer.accountKind).toBe('card');
			expect(transfer.clabe.replace(/\s+/g, '')).toMatch(/^\d{16}$/);
			expect(parsed.gifts?.title).toBe('Lluvia de sobres o transferencia');
		}
	});

	it('sets editorial-cover and editorial-catalog copy explicitly', () => {
		const parsed = eventContentSchema.parse(buildDestenidPublishedContent(buildTestAssets()));
		expect(parsed.hero.tagline).toBe('Mis XV, un nuevo capítulo.');
		// Real invitation: no fictional photographer credit.
		expect(parsed.hero.photoCredit).toBeUndefined();
		expect(parsed.gifts?.title).toMatch(/^Lluvia de sobres( o transferencia)?$/);
		expect(parsed.gifts?.folioMark).toBe('D·S');
	});

	it('uses the client program and keeps the client phrases literal', () => {
		const parsed = eventContentSchema.parse(buildDestenidPublishedContent(buildTestAssets()));
		expect(parsed.itinerary?.items.map((item) => [item.label, item.time])).toEqual([
			['Recepción', '19:00'],
			['Presentación de la quinceañera', '20:00'],
			['Cena', '20:30'],
			['Vals', '22:00'],
			['Cierre', '02:00'],
		]);
		expect(parsed.gallery?.subtitle).toBe(
			'¡Lit! Mi fiesta no sería lo mismo sin ti. Gracias por acompañarme en los momentos más icónicos.',
		);
		expect(parsed.gallery?.items?.every((item) => Boolean(item.alt))).toBe(true);
		// The client's chosen photograph leads both the mobile and desktop cover.
		expect(DESTENID_ASSET_SPECS.find((spec) => spec.key === 'heroPortrait')?.relativePath).toBe(
			'hero.jpg',
		);
		// The magazine cover uses its own photograph so the reveal differs from the hero.
		expect(parsed.envelope?.backdropImage).toBeDefined();
		expect(parsed.envelope?.backdropImage).not.toEqual(parsed.hero.backgroundImage);
	});

	it('does not expose placeholder or admin copy', () => {
		const content = buildDestenidPublishedContent(buildTestAssets());
		expect(collectPlaceholderStrings(content)).toEqual([]);
	});

	it('plays the client song from second 39', () => {
		const parsed = eventContentSchema.parse(buildDestenidPublishedContent(buildTestAssets()));
		expect(parsed.music?.url).toMatch(/^https:\/\/res\.cloudinary\.com\/.+\.mp3$/);
		expect(parsed.music?.startAt).toBe(39);
		expect(parsed.music?.autoPlay).toBe(true);
	});

	it('links the celebrant Instagram in the guest details', () => {
		const parsed = eventContentSchema.parse(buildDestenidPublishedContent(buildTestAssets()));
		const memories = parsed.location?.indications?.find((item) => item.title === 'Recuerdos');
		expect(memories?.text).toContain('href="https://www.instagram.com/desteny_ts/"');
	});
});
