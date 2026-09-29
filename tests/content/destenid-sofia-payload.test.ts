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
		expect(parsed.gifts?.items?.map((item) => item.type)).toEqual(['cash']);
	});

	it('sets editorial-cover and editorial-catalog copy explicitly', () => {
		const parsed = eventContentSchema.parse(buildDestenidPublishedContent(buildTestAssets()));
		expect(parsed.hero.tagline).toBe('Una noche entre moda, memoria y celebración.');
		// Real invitation: no fictional photographer credit.
		expect(parsed.hero.photoCredit).toBeUndefined();
		expect(parsed.gifts?.title).toBe('Mesa de cortesía');
		expect(parsed.gifts?.folioMark).toBe('D·S');
	});

	it('does not expose placeholder or admin copy', () => {
		const content = buildDestenidPublishedContent(buildTestAssets());
		expect(collectPlaceholderStrings(content)).toEqual([]);
	});
});
