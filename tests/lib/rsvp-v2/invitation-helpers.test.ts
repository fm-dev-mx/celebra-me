import {
	buildShareMessage,
	buildWhatsAppShareUrl,
} from '@/lib/rsvp/services/shared/invitation-helpers';
import {
	DEFAULT_REMINDER_MESSAGE,
	LEGACY_REMINDER_TEMPLATE_V1,
} from '@/lib/rsvp/services/shared/share-message-defaults';

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

	it('uses default invitation when shareMessages is not provided', () => {
		const result = buildShareMessage({
			...baseInput,
			shareMessages: null,
			includeLink: true,
		});
		expect(result).toContain('Hola Francisco Prueba');
		expect(result).toContain('XV Años de Ayrin Samantha');
		expect(result).toContain('https://www.celebra-me.com/i/GBOER6UK');
	});

	it('falls back to hardcoded default invitation when neither shareMessages nor template provided', () => {
		const result = buildShareMessage({
			...baseInput,
			includeLink: true,
		});
		expect(result).toContain('Francisco Prueba');
		expect(result).toContain('XV Años de Ayrin Samantha');
		expect(result).toContain('https://www.celebra-me.com/i/GBOER6UK');
	});

	it('uses default reminder when messageType is reminder and no shareMessages provided', () => {
		const result = buildShareMessage({
			...baseInput,
			messageType: 'reminder',
			includeLink: true,
		});
		expect(result).toContain('Francisco Prueba');
		expect(result).toContain('Confirma tu asistencia lo antes posible');
	});

	it('uses the real event title when shareMessages is null', () => {
		const result = buildShareMessage({
			...baseInput,
			eventTitle: 'XV Años de Ayrin Samantha',
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

	it('both message types include inviteUrl as /i/{shortId}', () => {
		const invitation = buildShareMessage({
			...baseInput,
			includeLink: true,
		});
		const reminder = buildShareMessage({
			...baseInput,
			messageType: 'reminder',
			includeLink: true,
		});
		expect(invitation).toContain('https://www.celebra-me.com/i/GBOER6UK');
		expect(reminder).toContain('https://www.celebra-me.com/i/GBOER6UK');
	});

	it('generates long invite URL when no shortId is provided', () => {
		const result = buildShareMessage({
			...baseInput,
			shortId: undefined,
			includeLink: true,
		});
		expect(result).toContain('?invite=invite-uuid-123');
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

	describe('reminder status-awareness', () => {
		it('uses pending default reminder for pending guest when no shareMessages provided', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'pending',
				includeLink: true,
			});
			expect(result).toContain('Confirma tu asistencia');
			expect(result).not.toContain('Ya tenemos registrada');
		});

		it('uses confirmed default reminder for confirmed guest when no shareMessages provided', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'confirmed',
				includeLink: true,
			});
			expect(result).toContain('Ya tenemos registrada tu asistencia');
			expect(result).not.toContain('Confirma tu asistencia');
		});

		it('uses confirmed default reminder when shareMessages.reminder is DEFAULT_REMINDER_MESSAGE', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'confirmed',
				shareMessages: {
					invitation: 'Invitation text',
					reminder: DEFAULT_REMINDER_MESSAGE,
				},
				includeLink: true,
			});
			expect(result).toContain('Ya tenemos registrada tu asistencia');
			expect(result).not.toContain('Confirma tu asistencia');
		});

		it('uses confirmed default reminder when shareMessages.reminder is empty string', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'confirmed',
				shareMessages: {
					invitation: 'Invitation text',
					reminder: '',
				},
				includeLink: true,
			});
			expect(result).toContain('Ya tenemos registrada tu asistencia');
		});

		it('respects truly custom reminder template for confirmed guests', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'confirmed',
				shareMessages: {
					invitation: 'Invitation text',
					reminder: 'Custom reminder for {guestName}: {inviteUrl}',
				},
				includeLink: true,
			});
			expect(result).toContain('Custom reminder for Francisco Prueba');
			expect(result).not.toContain('Ya tenemos registrada');
			expect(result).not.toContain('Confirma tu asistencia');
		});

		it('uses pending default for pending guest even when shareMessages has explicit DEFAULT_REMINDER_MESSAGE', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'pending',
				shareMessages: {
					invitation: 'Invitation text',
					reminder: DEFAULT_REMINDER_MESSAGE,
				},
				includeLink: true,
			});
			expect(result).toContain('Confirma tu asistencia');
			expect(result).not.toContain('Ya tenemos registrada');
		});

		it('uses pending default when attendanceStatus is undefined', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: undefined,
				includeLink: true,
			});
			expect(result).toContain('Confirma tu asistencia');
		});

		it('confirmed guest with custom template containing {{limite_confirmacion}} gets acknowledgment via placeholder safety net', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'confirmed',
				shareMessages: {
					invitation: 'Invitation text',
					reminder:
						'Hola {guestName}, te recordamos el evento.\n\n{rsvpDeadlineText}\n\n{inviteUrl}',
				},
				includeLink: true,
			});
			expect(result).toContain('Ya tenemos registrada tu asistencia');
			expect(result).toContain('te recordamos el evento');
			expect(result).not.toContain('Confirma tu asistencia');
		});

		it('confirmed guest with custom template having hardcoded confirmation text keeps it (custom is intentional)', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'confirmed',
				shareMessages: {
					invitation: 'Invitation text',
					reminder:
						'Hola {guestName}.\n\nPor favor confirma tu asistencia aquí:\n\n{inviteUrl}',
				},
				includeLink: true,
			});
			expect(result).toContain('Por favor confirma tu asistencia aquí');
		});

		it('confirmed guest with legacy reminder template V1 gets confirmed variant (known default)', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'confirmed',
				shareMessages: {
					invitation: 'Invitation text',
					reminder: LEGACY_REMINDER_TEMPLATE_V1,
				},
				includeLink: true,
			});
			expect(result).toContain('Ya tenemos registrada tu asistencia');
			expect(result).not.toContain('Por favor confirma tu asistencia aquí');
		});

		it('pending guest with legacy reminder template V1 gets confirmation CTA (known default)', () => {
			const result = buildShareMessage({
				...baseInput,
				messageType: 'reminder',
				attendanceStatus: 'pending',
				shareMessages: {
					invitation: 'Invitation text',
					reminder: LEGACY_REMINDER_TEMPLATE_V1,
				},
				includeLink: true,
			});
			expect(result).toContain('Confirma tu asistencia');
		});
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

	it('builds wa.me URL with encoded message containing /i/{shortId}', () => {
		const result = buildWhatsAppShareUrl(baseInput);
		expect(result).toMatch(/^https:\/\/wa\.me\//);
		expect(result).toContain('?text=');
		const decoded = decodeURIComponent(result.split('?text=')[1]);
		expect(decoded).toContain('Francisco Prueba');
		expect(decoded).toContain('https://www.celebra-me.com/i/GBOER6UK');
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
