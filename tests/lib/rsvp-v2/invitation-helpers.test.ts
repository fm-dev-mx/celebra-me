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
	it('uses shareMessages.invitation template by default', () => {
		const shareMessages = {
			invitation: 'Custom: {guestName} → {eventTitle} → {inviteUrl}',
			reminder: 'Reminder: {guestName} → {eventTitle} → {inviteUrl}',
		};
		const result = buildShareMessage({
			...baseInput,
			shareMessages,
			includeLink: true,
		});
		expect(result).toContain('Custom: Francisco Prueba');
		expect(result).toContain('XV Años de Ayrin Samantha');
		expect(result).toContain('celebra-me.com');
	});

	it('uses shareMessages.reminder template when messageType is reminder', () => {
		const shareMessages = {
			invitation: 'Invitation: {guestName} → {inviteUrl}',
			reminder: 'Reminder: {guestName} → {inviteUrl}',
		};
		const result = buildShareMessage({
			...baseInput,
			shareMessages,
			messageType: 'reminder',
			includeLink: true,
		});
		expect(result).toContain('Reminder: Francisco Prueba');
		expect(result).not.toContain('Invitation:');
	});

	it('falls back to legacy template when shareMessages is not provided', () => {
		const result = buildShareMessage({
			...baseInput,
			template: 'Legacy: {name} → {eventTitle} → {inviteUrl}',
			includeLink: true,
		});
		expect(result).toContain('Legacy: Francisco Prueba');
	});

	it('falls back to hardcoded default invitation when neither shareMessages nor template provided', () => {
		const result = buildShareMessage({
			...baseInput,
			includeLink: true,
		});
		expect(result).toContain('Francisco Prueba');
		expect(result).toContain('XV Años de Ayrin Samantha');
		expect(result).toContain('celebra-me.com');
	});

	it('uses default reminder when messageType is reminder and no shareMessages provided', () => {
		const result = buildShareMessage({
			...baseInput,
			messageType: 'reminder',
			includeLink: true,
		});
		expect(result).toContain('Francisco Prueba');
		expect(result).toContain('nuevamente');
	});

	it('uses the real event title when a client publication has no explicit template', () => {
		const result = buildShareMessage({
			...baseInput,
			eventTitle: 'XV Años de Ayrin Samantha',
			template: undefined,
			shareMessages: null,
			includeLink: true,
		});

		expect(result).toContain('XV Años de Ayrin Samantha');
	});

	it('strips {inviteUrl} when includeLink is false', () => {
		const result = buildShareMessage({
			...baseInput,
			includeLink: false,
		});
		expect(result).not.toContain('celebra-me.com');
		expect(result).toContain('Francisco Prueba');
	});

	it('invitation default includes greeting with guest name', () => {
		const result = buildShareMessage({
			...baseInput,
			includeLink: true,
		});
		expect(result).toContain('Hola Francisco Prueba');
	});

	it('reminder default includes greeting with guest name', () => {
		const result = buildShareMessage({
			...baseInput,
			messageType: 'reminder',
			includeLink: true,
		});
		expect(result).toContain('Hola Francisco Prueba');
	});

	it('both message types include inviteUrl', () => {
		const invitation = buildShareMessage({
			...baseInput,
			includeLink: true,
		});
		const reminder = buildShareMessage({
			...baseInput,
			messageType: 'reminder',
			includeLink: true,
		});
		expect(invitation).toContain('celebra-me.com');
		expect(reminder).toContain('celebra-me.com');
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

	it('uses shareMessages.invitation template in URL', () => {
		const shareMessages = {
			invitation: 'Custom msg for {guestName}: {inviteUrl}',
			reminder: 'Reminder msg',
		};
		const result = buildWhatsAppShareUrl({
			...baseInput,
			shareMessages,
		});
		const decoded = decodeURIComponent(result.split('?text=')[1]);
		expect(decoded).toContain('Custom msg for Francisco Prueba');
	});

	it('uses shareMessages.reminder template in URL when messageType is reminder', () => {
		const shareMessages = {
			invitation: 'Invitation msg',
			reminder: 'Reminder msg for {guestName}: {inviteUrl}',
		};
		const result = buildWhatsAppShareUrl({
			...baseInput,
			shareMessages,
			messageType: 'reminder',
		});
		const decoded = decodeURIComponent(result.split('?text=')[1]);
		expect(decoded).toContain('Reminder msg for Francisco Prueba');
	});
});
