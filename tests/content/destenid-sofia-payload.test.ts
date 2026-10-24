import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { resolveInvitationTheme } from '@/lib/intake/services/invitation-preset-resolver';
import {
	DESTENID_ASSET_SPECS,
	DESTENID_EVENT,
	buildDestenidPublishedContent,
	destenidInvitation,
} from '../../scripts/provision/invitations/destenid-sofia.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';
import { buildTestAssets } from '../helpers/managed-payload';

function publishedContent() {
	return buildDestenidPublishedContent(buildTestAssets(DESTENID_ASSET_SPECS));
}

describe('Destenid Sofía managed definition', () => {
	it('resolves from the managed registry', () => {
		expect(getInvitationDefinition('destenid-sofia')).toBe(destenidInvitation);
		expect(destenidInvitation.hostLoginAlias).toBe('destenid_sofia');
		expect(destenidInvitation.lifecycle).toBe('in_progress');
		expect(destenidInvitation.deliveryScope).toBe('content-and-assets');
	});

	it('uses a consistent editorial-magazine theme', () => {
		expect(resolveInvitationTheme({ themeId: DESTENID_EVENT.themeId })).toBe(
			DESTENID_EVENT.themeId,
		);
	});

	it('builds published content with authored editorial variants', () => {
		const parsed = eventContentSchema.parse(publishedContent());
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
		const parsed = eventContentSchema.parse(publishedContent());
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
		expect(transfer).toBeDefined();
		if (transfer && transfer.type === 'bank') {
			expect(transfer.bankName).toBe('BBVA');
			expect(transfer.accountHolder).toBe('Destenid Sofía Magaña Almaraz');
			expect(transfer.accountKind).toBe('card');
			expect(transfer.clabe.replace(/\s+/g, '')).toMatch(/^\d{16}$/);
			expect(transfer.title).toBe('Transferencia bancaria');
		}
	});

	it('sets editorial-cover and editorial-catalog copy explicitly', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.hero.tagline).toBe('Quince años, una sola vez.');
		// Real invitation: no fictional photographer credit.
		expect(parsed.hero.photoCredit).toBeUndefined();
		expect(parsed.gifts?.title).toBe('Un detalle para mí');
		expect(parsed.gifts?.folioMark).toBe('D·S');
	});

	it('uses the client program and keeps the client phrases literal', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.itinerary?.items.map((item) => [item.label, item.time])).toEqual([
			['Recepción', '19:00'],
			['Presentación de la quinceañera', '20:00'],
			['Cena', '20:30'],
			['Vals', '22:00'],
			['Cierre', '02:00'],
		]);
		expect(parsed.gallery?.subtitle).toBe(
			'¡Lit! Mi fiesta no sería lo mismo sin usted. Gracias por acompañarme en los momentos más icónicos.',
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

	it('plays the hosted loop cut that already starts at second 39', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.music?.url).toMatch(
			/^https:\/\/media\.celebra-me\.com\/invitations\/xv\/destenid-sofia\/music-[0-9a-f]{64}\.mp3$/,
		);
		expect(parsed.music?.startAt).toBeUndefined();
		expect(parsed.music?.autoPlay).toBe(true);
	});

	it('links the celebrant Instagram in the guest details', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		const memories = parsed.location?.indications?.find((item) => item.title === 'Recuerdos');
		expect(memories?.text).toContain('href="https://www.instagram.com/desteny_ts/"');
	});

	it('closes the program with the client note and states the dress-code colors', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.itinerary?.closingNote).toMatch(/^Habrá muchas sorpresas\./);
		expect(parsed.itinerary?.closingNote).toContain('hasta que el cuerpo diga ¡ya!');
		const dressCode = parsed.location?.indications?.find(
			(item) => item.iconName === 'DressCode',
		);
		expect(dressCode?.title).toBe('Código de vestimenta');
		expect(dressCode?.text).toContain('beige y dorado');
		expect(dressCode?.text).toContain('negro está reservado para la quinceañera y su mamá');
	});
});
