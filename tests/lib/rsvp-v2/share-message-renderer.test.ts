import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';

describe('renderShareMessage', () => {
	const baseContext = {
		guestName: 'María García',
		eventTitle: 'XV Años de Ayrin Samantha',
		inviteUrl: 'https://www.celebra-me.com/xv/ayrin-samantha/i/GBOER6UK',
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
});
