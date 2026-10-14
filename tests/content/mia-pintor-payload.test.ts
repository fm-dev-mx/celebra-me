import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { MIA_TIMING, miaInvitation } from '../../scripts/provision/invitations/mia-pintor.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';
import { buildTestAssets } from '../helpers/managed-payload';

function buildContent() {
	return miaInvitation.buildPublishedContent(buildTestAssets(miaInvitation.assets));
}

describe('Mía managed definition', () => {
	it('resolves from the managed registry with its host identity', () => {
		expect(getInvitationDefinition('mia-pintor')).toBe(miaInvitation);
		expect(miaInvitation.hostLoginAlias).toBe('mia_pintor');
		expect(miaInvitation.lifecycle).toBe('published');
		expect(miaInvitation.deliveryScope).toBe('content-and-assets');
		expect(miaInvitation.themeId).toBe('celestial-blue');
	});

	it('keeps the Tampico ceremony instant', () => {
		expect(MIA_TIMING).toEqual({
			localDateTime: '2026-12-06T17:00',
			timeZone: 'America/Monterrey',
			startsAtUtc: '2026-12-06T23:00:00.000Z',
		});
	});

	it('builds content with the seaside reveal', () => {
		const parsed = eventContentSchema.parse(buildContent());
		expect(parsed.envelope?.revealVariant).toBe('seaside-lineart');
		expect(parsed.envelope?.sealIcon).toBe('shell');
		expect(parsed.hero.variant).toBe('bleed-portrait');
	});

	it('honors the family-hosted brief and includes the official schedule and music', () => {
		const parsed = eventContentSchema.parse(buildContent());
		expect(parsed.family?.parents).toBeUndefined();
		expect(parsed.family?.godparents ?? []).toHaveLength(0);
		expect(parsed.itinerary).toBeDefined();
		expect(parsed.itinerary?.items).toHaveLength(7);
		expect(parsed.music?.url).toContain('Dancing_Queen_hxqiaf.mp3');
		expect(parsed.sectionOrder).toContain('itinerary');
		expect(parsed.location?.venues?.[1]?.time).toBe('18:30');
	});

	it('states the client restrictions and the envelope shower', () => {
		const parsed = eventContentSchema.parse(buildContent());
		const indications = (
			parsed.location?.indications
				?.map((item) => `${item.title ?? ''} ${item.text}`)
				.join(' ') ?? ''
		).toLowerCase();
		expect(indications).toContain('vestido de noche');
		expect(indications).toContain('azul cielo');
		expect(indications).toContain('solo para adultos');
		expect(parsed.gifts?.presentation).toBe('legend-only');
		expect(parsed.gifts?.subtitle?.toLowerCase()).toContain('lluvia de sobres');
		expect(parsed.rsvp?.accessMode).toBe('personalized-only');
		expect(parsed.rsvp?.confirmationMode).toBe('api');
	});
});
