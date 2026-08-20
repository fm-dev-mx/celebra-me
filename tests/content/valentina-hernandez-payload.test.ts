import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import {
	VALENTINA_ASSET_SPECS,
	VALENTINA_EVENT,
	buildValentinaPublishedContent,
	valentinaInvitation,
	type ValentinaAssetMap,
} from '../../scripts/provision/invitations/valentina-hernandez.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

const PLACEHOLDER_PATTERN =
	/PENDIENTE|\[confirmar|Confirmar ubicación|definir fecha límite|confirmar número de registro|Solicitar enlace de Google Maps|^Por confirmar$|Pendiente de confirmar/i;

function buildTestAssets(): ValentinaAssetMap {
	return Object.fromEntries(
		VALENTINA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as ValentinaAssetMap;
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

describe('Valentina Hernández managed definition', () => {
	it('resolves from the managed registry', () => {
		expect(getInvitationDefinition('valentina-hernandez')).toBe(valentinaInvitation);
		expect(valentinaInvitation.hostLoginAlias).toBe('valentina_hernandez');
		expect(valentinaInvitation.lifecycle).toBe('published');
		expect(valentinaInvitation.deliveryScope).toBe('content-only');
	});

	it('uses a consistent editorial-magazine catalog entry', () => {
		const preset = findDemoPreset(VALENTINA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-xv-editorial-magazine',
			eventType: 'xv',
			themeId: 'editorial-magazine',
		});
		expect(
			checkPublishGuard({
				baseDemoId: VALENTINA_EVENT.baseDemoId,
				themeId: VALENTINA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('builds schema-valid published content with authored editorial variants', () => {
		const content = buildValentinaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect({
			success: result.success,
			...(result.success ? {} : { issues: result.error.issues }),
		}).toStrictEqual({ success: true });

		const parsed = eventContentSchema.parse(content);
		expect(parsed.hero.variant).toBe('editorial-cover');
		expect(parsed.countdown?.variant).toBe('magazine-folio');
		expect(parsed.gallery?.variant).toBe('magazine-spread');
		expect(parsed.gallery?.presentationOptions?.mobileBrowse).toBe('rail');
		expect(parsed.itinerary?.variant).toBe('editorial-program');
		expect(parsed.gifts?.variant).toBe('editorial-catalog');
		expect(parsed.rsvp?.variant).toBe('editorial-press-pass');
		expect(parsed.rsvp?.personalizedAccess?.variant).toBe('editorial-pass');
		expect(parsed.thankYou?.variant).toBe('editorial-back-cover');
		expect(parsed.envelope?.revealVariant).toBe('editorial-cover');
		expect(parsed.location?.indications?.[0]?.title).toBe('Código de vestimenta');
		expect(parsed.location?.indications?.[1]?.title).toBe('Confirmación');
		expect(parsed.location?.indications?.[2]?.title).toBe('Puntualidad');
		expect(parsed.location?.indications?.[3]?.title).toBe('Ambiente');
		expect(parsed.location?.indications?.[4]?.title).toBe('Recuerdos');
		expect(parsed.visualProfileId).toBe('valentina-hernandez');
	});

	it('does not expose placeholder or admin copy', () => {
		const content = buildValentinaPublishedContent(buildTestAssets());
		expect(collectPlaceholderStrings(content)).toEqual([]);
	});
});
