import {
	buildShareMessage,
	buildWhatsAppShareUrl,
} from '@/lib/rsvp/services/shared/invitation-helpers';

const baseInput = {
	origin: 'https://www.celebra-me.com',
	inviteId: 'invite-uuid-123',
	phone: '5512345678',
	countryCode: '+52',
	fullName: 'Francisco Prueba',
	eventTitle: 'XV Años de Ayrin Samantha',
	eventType: 'xv' as const,
	eventSlug: 'ayrin-samantha-lerma-castro',
	shortId: 'GBOER6UK',
};

describe('buildShareMessage', () => {
	it('uses shareMessages.with-phone template when shareMessages provided', () => {
		const shareMessages = {
			whatsappWithPhone: 'Custom: {guestName} → {eventTitle} → {inviteUrl}',
			whatsappWithoutPhone: 'No phone: {eventTitle} → {inviteUrl}',
		};
		const result = buildShareMessage({
			...baseInput,
			shareMessages,
			variant: 'with-phone',
			includeLink: true,
		});
		expect(result).toContain('Custom: Francisco Prueba');
		expect(result).toContain('XV Años de Ayrin Samantha');
		expect(result).toContain('celebra-me.com');
	});

	it('uses shareMessages.without-phone template when variant is without-phone', () => {
		const shareMessages = {
			whatsappWithPhone: 'With phone: {guestName}',
			whatsappWithoutPhone: 'Sin teléfono: {eventTitle} → {inviteUrl}',
		};
		const result = buildShareMessage({
			...baseInput,
			shareMessages,
			variant: 'without-phone',
			includeLink: true,
		});
		expect(result).toContain('Sin teléfono: XV Años de Ayrin Samantha');
		expect(result).not.toContain('Francisco Prueba');
	});

	it('falls back to legacy template when shareMessages is not provided', () => {
		const result = buildShareMessage({
			...baseInput,
			template: 'Legacy: {name} → {eventTitle} → {inviteUrl}',
			includeLink: true,
		});
		expect(result).toContain('Legacy: Francisco Prueba');
	});

	it('falls back to hardcoded default when neither shareMessages nor template provided', () => {
		const result = buildShareMessage({
			...baseInput,
			includeLink: true,
		});
		expect(result).toContain('Francisco Prueba');
		expect(result).toContain('XV Años de Ayrin Samantha');
		expect(result).toContain('celebra-me.com');
	});

	it('strips {inviteUrl} when includeLink is false', () => {
		const result = buildShareMessage({
			...baseInput,
			includeLink: false,
		});
		expect(result).not.toContain('celebra-me.com');
		expect(result).toContain('Francisco Prueba');
	});

	it('with-phone default includes greeting with guest name', () => {
		const result = buildShareMessage({
			...baseInput,
			includeLink: true,
		});
		expect(result).toContain('Hola Francisco Prueba');
	});

	it('without-phone default omits greeting', () => {
		const result = buildShareMessage({
			...baseInput,
			variant: 'without-phone',
			includeLink: true,
		});
		expect(result).not.toContain('Hola');
		expect(result).toContain('XV Años de Ayrin Samantha');
	});

	it('both variants include inviteUrl', () => {
		const withPhone = buildShareMessage({
			...baseInput,
			variant: 'with-phone',
			includeLink: true,
		});
		const withoutPhone = buildShareMessage({
			...baseInput,
			variant: 'without-phone',
			includeLink: true,
		});
		expect(withPhone).toContain('celebra-me.com');
		expect(withoutPhone).toContain('celebra-me.com');
	});

	it('cleans up empty guest name without artifacts', () => {
		const result = buildShareMessage({
			...baseInput,
			fullName: '',
			includeLink: true,
		});
		expect(result).not.toContain('Hola ,');
		expect(result).not.toContain('Hola  ');
	});
});

describe('buildWhatsAppShareUrl', () => {
	it('returns empty string when phone is empty', () => {
		const result = buildWhatsAppShareUrl({
			...baseInput,
			phone: '',
		});
		expect(result).toBe('');
	});

	it('builds wa.me URL with encoded message', () => {
		const result = buildWhatsAppShareUrl(baseInput);
		expect(result).toMatch(/^https:\/\/wa\.me\//);
		expect(result).toContain('?text=');
		const decoded = decodeURIComponent(result.split('?text=')[1]);
		expect(decoded).toContain('Francisco Prueba');
		expect(decoded).toContain('celebra-me.com');
	});

	it('encodes accents and newlines in message', () => {
		const result = buildWhatsAppShareUrl(baseInput);
		expect(result).toContain('%C3%B3');
	});

	it('includes phone number with country code in URL', () => {
		const result = buildWhatsAppShareUrl(baseInput);
		expect(result).toMatch(/wa\.me\/525512345678/);
	});

	it('uses shareMessages template in URL', () => {
		const shareMessages = {
			whatsappWithPhone: 'Custom msg for {guestName}: {inviteUrl}',
			whatsappWithoutPhone: 'No phone msg',
		};
		const result = buildWhatsAppShareUrl({
			...baseInput,
			shareMessages,
			variant: 'with-phone',
		});
		const decoded = decodeURIComponent(result.split('?text=')[1]);
		expect(decoded).toContain('Custom msg for Francisco Prueba');
	});
});
