import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { resolveInvitationTheme } from '@/lib/intake/services/invitation-preset-resolver';
import {
	VALENTINA_ASSET_SPECS,
	VALENTINA_EVENT,
	buildValentinaPublishedContent,
	valentinaInvitation,
} from '../../scripts/provision/invitations/valentina-hernandez.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';
import { buildTestAssets } from '../helpers/managed-payload';

function publishedContent() {
	return buildValentinaPublishedContent(buildTestAssets(VALENTINA_ASSET_SPECS));
}

describe('Valentina Hernández managed definition', () => {
	it('resolves from the managed registry', () => {
		expect(getInvitationDefinition('valentina-hernandez')).toBe(valentinaInvitation);
		expect(valentinaInvitation.hostLoginAlias).toBe('valentina_hernandez');
		expect(valentinaInvitation.lifecycle).toBe('published');
		expect(valentinaInvitation.deliveryScope).toBe('content-and-assets');
	});

	it('uses a consistent editorial-magazine theme', () => {
		expect(resolveInvitationTheme({ themeId: VALENTINA_EVENT.themeId })).toBe(
			VALENTINA_EVENT.themeId,
		);
	});

	it('builds published content with authored editorial variants', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.hero.variant).toBe('editorial-cover');
		expect(parsed.countdown?.variant).toBe('magazine-folio');
		expect(parsed.gallery?.variant).toBe('magazine-spread');
		expect(parsed.gallery?.variantOptions?.mobileBrowse).toBe('rail');
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

	it('sets editorial-cover and editorial-catalog copy explicitly', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.hero.tagline).toBe('Una noche entre moda, memoria y celebración.');
		// Real invitation: no fictional photographer credit.
		expect(parsed.hero.photoCredit).toBeUndefined();
		expect(parsed.gifts?.title).toBe('Mesa de cortesía');
		expect(parsed.gifts?.folioMark).toBe('VH');
	});
});
