import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
	DEFAULT_REMINDER_SETTINGS,
	resolveReminderSettings,
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

describe('resolveReminderSettings', () => {
	it('returns defaults when input is null', () => {
		expect(resolveReminderSettings(null)).toEqual(DEFAULT_REMINDER_SETTINGS);
	});

	it('returns defaults when input is undefined', () => {
		expect(resolveReminderSettings(undefined)).toEqual(DEFAULT_REMINDER_SETTINGS);
	});

	it('returns defaults when input is empty object', () => {
		expect(resolveReminderSettings({})).toEqual(DEFAULT_REMINDER_SETTINGS);
	});

	it('accepts valid enabled', () => {
		expect(resolveReminderSettings({ enabled: false }).enabled).toBe(false);
		expect(resolveReminderSettings({ enabled: true }).enabled).toBe(true);
	});

	it('normalizes non-boolean enabled to default', () => {
		const result = resolveReminderSettings({ enabled: 1 as unknown as boolean });
		expect(result.enabled).toBe(DEFAULT_REMINDER_SETTINGS.enabled);
	});

	it('accepts valid showWhenDaysBeforeEvent', () => {
		expect(
			resolveReminderSettings({ showWhenDaysBeforeEvent: 0 }).showWhenDaysBeforeEvent,
		).toBe(0);
		expect(
			resolveReminderSettings({ showWhenDaysBeforeEvent: 30 }).showWhenDaysBeforeEvent,
		).toBe(30);
	});

	it('normalizes negative showWhenDaysBeforeEvent to default', () => {
		const result = resolveReminderSettings({ showWhenDaysBeforeEvent: -5 });
		expect(result.showWhenDaysBeforeEvent).toBe(
			DEFAULT_REMINDER_SETTINGS.showWhenDaysBeforeEvent,
		);
	});

	it('normalizes NaN showWhenDaysBeforeEvent to default', () => {
		const result = resolveReminderSettings({ showWhenDaysBeforeEvent: NaN });
		expect(result.showWhenDaysBeforeEvent).toBe(
			DEFAULT_REMINDER_SETTINGS.showWhenDaysBeforeEvent,
		);
	});

	it('accepts valid audience values', () => {
		expect(resolveReminderSettings({ audience: 'unconfirmed' }).audience).toBe('unconfirmed');
		expect(resolveReminderSettings({ audience: 'all-shared' }).audience).toBe('all-shared');
	});

	it('normalizes invalid audience to default', () => {
		const result = resolveReminderSettings({
			audience: 'everyone' as unknown as 'unconfirmed',
		});
		expect(result.audience).toBe(DEFAULT_REMINDER_SETTINGS.audience);
	});

	it('merges valid partial input with defaults', () => {
		const result = resolveReminderSettings({ enabled: false });
		expect(result.enabled).toBe(false);
		expect(result.showWhenDaysBeforeEvent).toBe(
			DEFAULT_REMINDER_SETTINGS.showWhenDaysBeforeEvent,
		);
		expect(result.audience).toBe(DEFAULT_REMINDER_SETTINGS.audience);
	});
});
