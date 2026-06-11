import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
	resolveShareDescription,
} from '@/lib/rsvp/services/shared/share-message-defaults';

describe('DEFAULT_INVITATION_MESSAGE', () => {
	it('starts with greeting and guest name placeholder', () => {
		expect(DEFAULT_INVITATION_MESSAGE).toMatch(/^Hola \{guestName\}/);
	});

	it('contains event title placeholder', () => {
		expect(DEFAULT_INVITATION_MESSAGE).toContain('{eventTitle}');
	});

	it('contains invite URL placeholder', () => {
		expect(DEFAULT_INVITATION_MESSAGE).toContain('{inviteUrl}');
	});

	it('places inviteUrl at the end of the message', () => {
		const lines = DEFAULT_INVITATION_MESSAGE.split('\n').filter(Boolean);
		expect(lines[lines.length - 1].trim()).toBe('{inviteUrl}');
	});

	it('contains the Ábrela call to action before the link', () => {
		const linkIndex = DEFAULT_INVITATION_MESSAGE.indexOf('{inviteUrl}');
		const beforeLink = DEFAULT_INVITATION_MESSAGE.slice(0, linkIndex);
		expect(beforeLink).toContain('Ábrela para ver los detalles y confirmar tu asistencia');
	});
});

describe('DEFAULT_REMINDER_MESSAGE', () => {
	it('starts with greeting and guest name placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE).toMatch(/^Hola \{guestName\}/);
	});

	it('contains eventTimingText placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE).toContain('{eventTimingText}');
	});

	it('contains rsvpDeadlineText placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE).toContain('{rsvpDeadlineText}');
	});

	it('contains inviteUrl placeholder at the end', () => {
		const lines = DEFAULT_REMINDER_MESSAGE.split('\n').filter(Boolean);
		expect(lines[lines.length - 1].trim()).toBe('{inviteUrl}');
	});
});

describe('resolveShareDescription', () => {
	it('returns non-empty custom description as-is', () => {
		expect(resolveShareDescription('Custom desc', 'XV Años')).toBe('Custom desc');
	});

	it('generates fallback when ogDescription is empty string', () => {
		const result = resolveShareDescription('', 'XV Años de Ayrin');
		expect(result).toContain('XV Años de Ayrin');
		expect(result).toContain('detalles');
	});

	it('generates fallback when ogDescription is undefined', () => {
		const result = resolveShareDescription(undefined, 'Boda');
		expect(result).toContain('Boda');
	});

	it('generates fallback when ogDescription is null', () => {
		const result = resolveShareDescription(null, 'Fiesta');
		expect(result).toContain('Fiesta');
	});

	it('treats whitespace-only ogDescription as empty', () => {
		const result = resolveShareDescription('   ', 'XV Años');
		expect(result).toContain('XV Años');
	});

	it('falls back to generic text when eventTitle is blank', () => {
		const result = resolveShareDescription(undefined, '');
		expect(result).toContain('la invitación');
	});

	it('falls back to generic text when eventTitle is whitespace', () => {
		const result = resolveShareDescription(null, '   ');
		expect(result).toContain('la invitación');
	});
});
