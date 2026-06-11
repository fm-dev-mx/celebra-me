import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
} from '@/lib/rsvp/services/shared/share-message-defaults';

describe('renderShareMessage', () => {
	const baseContext = {
		guestName: 'María García',
		eventTitle: 'XV Años de Ayrin Samantha',
		inviteUrl: 'https://www.celebra-me.com/xv/ayrin-samantha/i/GBOER6UK',
	};

	const timingContext = {
		eventTimingText: 'Te recordamos que faltan 51 días para XV Años de Ayrin Samantha.',
		rsvpDeadlineText: 'Confirma tu asistencia antes del 10 de junio de 2026.',
		eventDate: '31 de julio de 2026',
		daysUntilEvent: '51',
		rsvpDeadline: '10 de junio de 2026',
	};

	it('replaces all standard placeholders', () => {
		const template = 'Hola {guestName}, te invitamos a {eventTitle}: {inviteUrl}';
		const result = renderShareMessage(template, baseContext);
		expect(result).toBe(
			'Hola María García, te invitamos a XV Años de Ayrin Samantha: https://www.celebra-me.com/xv/ayrin-samantha/i/GBOER6UK',
		);
	});

	it('replaces all occurrences of the same placeholder', () => {
		const template = '{guestName} - {guestName} - {eventTitle}';
		const result = renderShareMessage(template, baseContext);
		expect(result).toBe('María García - María García - XV Años de Ayrin Samantha');
	});

	it('supports legacy {name} placeholder', () => {
		const template = 'Hola {name}, tu invitación: {inviteUrl}';
		const result = renderShareMessage(template, baseContext);
		expect(result).toContain('Hola María García');
	});

	it('supports legacy {fullName} placeholder', () => {
		const template = 'Estimado {fullName}, tu invitación: {inviteUrl}';
		const result = renderShareMessage(template, baseContext);
		expect(result).toContain('Estimado María García');
	});

	it('falls back to "nuestra celebración" when eventTitle is missing', () => {
		const template = 'Te invitamos a {eventTitle}: {inviteUrl}';
		const result = renderShareMessage(template, { ...baseContext, eventTitle: null });
		expect(result).toContain('nuestra celebración');
	});

	it('falls back to "nuestra celebración" when eventTitle is empty string', () => {
		const template = 'Te invitamos a {eventTitle}: {inviteUrl}';
		const result = renderShareMessage(template, { ...baseContext, eventTitle: '' });
		expect(result).toContain('nuestra celebración');
	});

	it('cleans up empty greeting when guestName is null', () => {
		const template =
			'Hola {guestName}, te compartimos tu invitación a {eventTitle}:\n\n{inviteUrl}';
		const result = renderShareMessage(template, { ...baseContext, guestName: null });
		expect(result).not.toContain('Hola ,');
		expect(result).not.toContain('Hola  ');
		expect(result).toContain('te compartimos tu invitación');
		expect(result).toContain(baseContext.inviteUrl);
	});

	it('cleans up empty greeting when guestName is empty string', () => {
		const template = 'Hola {guestName}, te invitamos a {eventTitle}';
		const result = renderShareMessage(template, { ...baseContext, guestName: '' });
		expect(result).not.toContain('Hola ,');
		expect(result).not.toContain('Hola  ');
	});

	it('preserves newlines in template', () => {
		const template =
			'Hola {guestName},\n\nTe invitamos a {eventTitle}:\n\n{inviteUrl}\n\n¡Te esperamos!';
		const result = renderShareMessage(template, baseContext);
		expect(result).toContain('\n\n');
		expect(result).toContain('¡Te esperamos!');
	});

	it('handles accents and special characters safely', () => {
		const template = 'Invitación de {guestName} para {eventTitle} — {inviteUrl}';
		const context = {
			guestName: 'José Ángel Núñez',
			eventTitle: 'XV Años de Sofía & María José',
			inviteUrl: 'https://example.com/i/abc123',
		};
		const result = renderShareMessage(template, context);
		expect(result).toContain('José Ángel Núñez');
		expect(result).toContain('XV Años de Sofía & María José');
	});

	it('handles undefined guestName gracefully', () => {
		const template = 'Hola {guestName}, te invitamos a {eventTitle}';
		const result = renderShareMessage(template, {
			guestName: undefined,
			eventTitle: 'Fiesta',
			inviteUrl: 'https://example.com',
		});
		expect(result).not.toContain('Hola ,');
		expect(result).toContain('te invitamos a Fiesta');
	});

	it('renders DEFAULT_INVITATION_MESSAGE with link at the end', () => {
		const result = renderShareMessage(DEFAULT_INVITATION_MESSAGE, {
			...baseContext,
			inviteUrl: 'https://celebra-me.com/i/abc123',
		});
		expect(result).toMatch(/^Hola María García/);
		expect(result).toContain('XV Años de Ayrin Samantha');
		expect(result).toContain('Ábrela para ver los detalles');
		expect(result).toContain('https://celebra-me.com/i/abc123');
		const lines = result.split('\n').filter(Boolean);
		expect(lines[lines.length - 1].trim()).toBe('https://celebra-me.com/i/abc123');
	});

	it('renders DEFAULT_REMINDER_MESSAGE with timing and deadline text', () => {
		const result = renderShareMessage(DEFAULT_REMINDER_MESSAGE, {
			...baseContext,
			...timingContext,
		});
		expect(result).toMatch(/^Hola María García/);
		expect(result).toContain('Te recordamos que faltan 51 días');
		expect(result).toContain('Confirma tu asistencia antes del 10 de junio de 2026');
		const lines = result.split('\n').filter(Boolean);
		expect(lines[lines.length - 1].trim()).toBe(baseContext.inviteUrl);
	});

	it('renders DEFAULT_REMINDER_MESSAGE with custom rsvpDeadlineText', () => {
		const result = renderShareMessage(DEFAULT_REMINDER_MESSAGE, {
			...baseContext,
			eventTimingText: 'Te recordamos que faltan 51 días para XV Años de Ayrin Samantha.',
			rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
			rsvpDeadline: '',
			eventDate: '31 de julio de 2026',
			daysUntilEvent: '51',
		});
		expect(result).toContain('lo antes posible');
		expect(result).not.toContain('undefined');
		expect(result).not.toContain('null');
	});

	it('normalizes triple newlines to double newlines', () => {
		const template = 'Line 1\n\n\nLine 2\n\n\n\n{inviteUrl}';
		const result = renderShareMessage(template, baseContext);
		expect(result).not.toContain('\n\n\n');
	});

	it('produces no undefined or null text in output', () => {
		const result = renderShareMessage(DEFAULT_INVITATION_MESSAGE, {
			...baseContext,
			eventTimingText: undefined,
			rsvpDeadlineText: undefined,
			eventDate: undefined,
			daysUntilEvent: undefined,
			rsvpDeadline: undefined,
		});
		expect(result).not.toContain('undefined');
		expect(result).not.toContain('null');
	});
});
