import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
	DEFAULT_REMINDER_MESSAGE_CONFIRMED,
	DEFAULT_REMINDER_SETTINGS,
	LEGACY_REMINDER_TEMPLATE_V1,
	getDefaultInvitationTemplate,
	getDefaultReminderTemplate,
	getSuggestedPresets,
	smartInsertVariable,
	isDefaultReminderTemplate,
	resolveReminderTemplate,
	resolveReminderSettings,
	resolveShareDescription,
	EVENT_SPECIFIC_INVITATION_MESSAGES,
	EVENT_SPECIFIC_REMINDER_MESSAGES,
	EVENT_SPECIFIC_REMINDER_CONFIRMED,
} from '@/lib/rsvp/services/shared/share-message-defaults';

describe('DEFAULT_INVITATION_MESSAGE', () => {
	it('starts with greeting and Spanish guest name placeholder', () => {
		expect(DEFAULT_INVITATION_MESSAGE).toMatch(/^Hola \{\{invitado\}\}/);
	});

	it('contains Spanish event title placeholder', () => {
		expect(DEFAULT_INVITATION_MESSAGE).toContain('{{evento}}');
	});

	it('contains Spanish invite URL placeholder', () => {
		expect(DEFAULT_INVITATION_MESSAGE).toContain('{{enlace}}');
	});

	it('contains the Ábrela call to action after the link', () => {
		const linkIndex = DEFAULT_INVITATION_MESSAGE.indexOf('{{enlace}}');
		const afterLink = DEFAULT_INVITATION_MESSAGE.slice(linkIndex);
		expect(afterLink).toContain('Ábrela para ver los detalles y confirmar tu asistencia');
	});
});

describe('DEFAULT_REMINDER_MESSAGE', () => {
	it('starts with greeting and Spanish guest name placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE).toMatch(/^Hola \{\{invitado\}\}/);
	});

	it('contains Spanish hora_evento placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE).toContain('{{hora_evento}}');
	});

	it('contains Spanish limite_confirmacion placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE).toContain('{{limite_confirmacion}}');
	});

	it('contains Spanish enlace placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE).toContain('{{enlace}}');
	});
});

describe('DEFAULT_REMINDER_MESSAGE_CONFIRMED', () => {
	it('starts with greeting and Spanish guest name placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE_CONFIRMED).toMatch(/^Hola \{\{invitado\}\}/);
	});

	it('contains hora_evento placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE_CONFIRMED).toContain('{{hora_evento}}');
	});

	it('contains enlace placeholder', () => {
		expect(DEFAULT_REMINDER_MESSAGE_CONFIRMED).toContain('{{enlace}}');
	});

	it('acknowledges existing confirmation and avoids asking to confirm again', () => {
		expect(DEFAULT_REMINDER_MESSAGE_CONFIRMED).toContain('Ya tenemos registrada tu asistencia');
		expect(DEFAULT_REMINDER_MESSAGE_CONFIRMED).not.toContain('{{limite_confirmacion}}');
		expect(DEFAULT_REMINDER_MESSAGE_CONFIRMED).not.toContain('confirma');
	});
});

describe('getDefaultReminderTemplate', () => {
	it('returns pending variant when status is pending', () => {
		expect(getDefaultReminderTemplate('pending')).toBe(DEFAULT_REMINDER_MESSAGE);
	});

	it('returns confirmed variant when status is confirmed', () => {
		expect(getDefaultReminderTemplate('confirmed')).toBe(DEFAULT_REMINDER_MESSAGE_CONFIRMED);
	});

	it('returns pending variant when status is undefined', () => {
		expect(getDefaultReminderTemplate(undefined)).toBe(DEFAULT_REMINDER_MESSAGE);
	});

	it('returns pending variant when status is declined', () => {
		expect(getDefaultReminderTemplate('declined')).toBe(DEFAULT_REMINDER_MESSAGE);
	});
});

describe('isDefaultReminderTemplate', () => {
	it('returns true for undefined', () => {
		expect(isDefaultReminderTemplate(undefined)).toBe(true);
	});

	it('returns true for null', () => {
		expect(isDefaultReminderTemplate(null)).toBe(true);
	});

	it('returns true for empty string', () => {
		expect(isDefaultReminderTemplate('')).toBe(true);
	});

	it('returns true for exact DEFAULT_REMINDER_MESSAGE', () => {
		expect(isDefaultReminderTemplate(DEFAULT_REMINDER_MESSAGE)).toBe(true);
	});

	it('returns false for a custom template string', () => {
		expect(isDefaultReminderTemplate('Hola {{invitado}}, mensaje personalizado.')).toBe(false);
	});

	it('returns false for structurally different template', () => {
		expect(
			isDefaultReminderTemplate(
				'Hola {{invitado}}, te recordamos que faltan {{dias_faltantes}} días. Por favor confirma tu asistencia.',
			),
		).toBe(false);
	});

	it('returns true for exact legacy reminder template V1 (local DB found)', () => {
		expect(isDefaultReminderTemplate(LEGACY_REMINDER_TEMPLATE_V1)).toBe(true);
	});

	it('returns true for DEFAULT_REMINDER_MESSAGE with trailing whitespace (normalized)', () => {
		expect(isDefaultReminderTemplate(DEFAULT_REMINDER_MESSAGE + ' ')).toBe(true);
	});

	it('returns true for DEFAULT_REMINDER_MESSAGE with CRLF line endings (normalized)', () => {
		const crlfDefault = DEFAULT_REMINDER_MESSAGE.replace(/\n/g, '\r\n');
		expect(isDefaultReminderTemplate(crlfDefault)).toBe(true);
	});
});

describe('resolveReminderTemplate', () => {
	it('returns confirmed variant when default template + confirmed status', () => {
		expect(resolveReminderTemplate(DEFAULT_REMINDER_MESSAGE, 'confirmed')).toBe(
			DEFAULT_REMINDER_MESSAGE_CONFIRMED,
		);
	});

	it('returns pending variant when default template + pending status', () => {
		expect(resolveReminderTemplate(DEFAULT_REMINDER_MESSAGE, 'pending')).toBe(
			DEFAULT_REMINDER_MESSAGE,
		);
	});

	it('returns custom template unchanged for confirmed status', () => {
		const custom = 'Mensaje personalizado para {guestName}';
		expect(resolveReminderTemplate(custom, 'confirmed')).toBe(custom);
	});

	it('returns default pending variant when template is undefined', () => {
		expect(resolveReminderTemplate(undefined, 'pending')).toBe(DEFAULT_REMINDER_MESSAGE);
	});

	it('returns default confirmed variant when template is null + confirmed status', () => {
		expect(resolveReminderTemplate(null, 'confirmed')).toBe(DEFAULT_REMINDER_MESSAGE_CONFIRMED);
	});

	it('returns default pending variant when template is empty string', () => {
		expect(resolveReminderTemplate('', 'pending')).toBe(DEFAULT_REMINDER_MESSAGE);
	});

	it('returns confirmed variant via normalized match (CRLF)', () => {
		const crlfDefault = DEFAULT_REMINDER_MESSAGE.replace(/\n/g, '\r\n');
		expect(resolveReminderTemplate(crlfDefault, 'confirmed')).toBe(
			DEFAULT_REMINDER_MESSAGE_CONFIRMED,
		);
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

describe('getDefaultInvitationTemplate (event-specific)', () => {
	it('returns wedding-specific copy for "boda"', () => {
		const template = getDefaultInvitationTemplate('boda');
		expect(template).toBe(EVENT_SPECIFIC_INVITATION_MESSAGES.boda);
		expect(template).toContain('invitación a nuestra boda');
		expect(template).toContain('{{enlace}}');
		expect(template).toContain('confirmar su asistencia');
	});

	it('returns xv-specific copy for "xv"', () => {
		const template = getDefaultInvitationTemplate('xv');
		expect(template).toBe(EVENT_SPECIFIC_INVITATION_MESSAGES.xv);
		expect(template).toContain('mis XV años');
	});

	it('returns baptism-specific copy for "bautizo"', () => {
		const template = getDefaultInvitationTemplate('bautizo');
		expect(template).toBe(EVENT_SPECIFIC_INVITATION_MESSAGES.bautizo);
		expect(template).toContain('Bautismo');
	});

	it('returns baby shower copy for "baby-shower"', () => {
		const template = getDefaultInvitationTemplate('baby-shower');
		expect(template).toBe(EVENT_SPECIFIC_INVITATION_MESSAGES['baby-shower']);
		expect(template).toContain('Baby Shower');
	});

	it('returns first communion copy for "primera-comunion"', () => {
		const template = getDefaultInvitationTemplate('primera-comunion');
		expect(template).toBe(EVENT_SPECIFIC_INVITATION_MESSAGES['primera-comunion']);
		expect(template).toContain('Primera Comunión');
	});

	it('returns birthday copy for "cumple"', () => {
		const template = getDefaultInvitationTemplate('cumple');
		expect(template).toBe(EVENT_SPECIFIC_INVITATION_MESSAGES.cumple);
		expect(template).toContain('cumpleaños');
	});

	it('does not include {{evento}} in any event-specific invitation templates to avoid redundant titles', () => {
		for (const msg of Object.values(EVENT_SPECIFIC_INVITATION_MESSAGES)) {
			expect(msg).not.toContain('{{evento}}');
		}
	});

	it('falls back to DEFAULT_INVITATION_MESSAGE for undefined or unknown type', () => {
		expect(getDefaultInvitationTemplate(undefined)).toBe(DEFAULT_INVITATION_MESSAGE);
		expect(getDefaultInvitationTemplate('evento-desconocido')).toBe(DEFAULT_INVITATION_MESSAGE);
	});
});

describe('getDefaultReminderTemplate (event-specific)', () => {
	it('returns event-specific pending reminder for "boda"', () => {
		const template = getDefaultReminderTemplate('pending', 'boda');
		expect(template).toBe(EVENT_SPECIFIC_REMINDER_MESSAGES.boda);
		expect(template).toContain('nuestro matrimonio');
	});

	it('returns event-specific confirmed reminder for "boda"', () => {
		const template = getDefaultReminderTemplate('confirmed', 'boda');
		expect(template).toBe(EVENT_SPECIFIC_REMINDER_CONFIRMED.boda);
		expect(template).toContain('nuestro matrimonio');
		expect(template).toContain('Ya tenemos registrada su asistencia');
	});

	it('returns event-specific pending reminder for "xv"', () => {
		const template = getDefaultReminderTemplate('pending', 'xv');
		expect(template).toBe(EVENT_SPECIFIC_REMINDER_MESSAGES.xv);
		expect(template).toContain('mis XV años');
	});

	it('returns event-specific confirmed reminder for "xv"', () => {
		const template = getDefaultReminderTemplate('confirmed', 'xv');
		expect(template).toBe(EVENT_SPECIFIC_REMINDER_CONFIRMED.xv);
		expect(template).toContain('la cuenta regresiva para mis XV años');
	});
});

describe('smartInsertVariable', () => {
	it('adds leading space when inserting after a word without space', () => {
		const result = smartInsertVariable('Hola', 4, 4, '{{invitado}}');
		expect(result.newText).toBe('Hola {{invitado}}');
		expect(result.wasDuplicate).toBe(false);
	});

	it('does not add double space if space is already present', () => {
		const result = smartInsertVariable('Hola ', 5, 5, '{{invitado}}');
		expect(result.newText).toBe('Hola {{invitado}}');
		expect(result.wasDuplicate).toBe(false);
	});

	it('adds trailing space if following text is immediately adjacent', () => {
		const result = smartInsertVariable('Holaamigos', 4, 4, '{{invitado}}');
		expect(result.newText).toBe('Hola {{invitado}} amigos');
	});

	it('does not add trailing space if followed by punctuation or newline', () => {
		const result = smartInsertVariable('Hola,', 4, 4, '{{invitado}}');
		expect(result.newText).toBe('Hola {{invitado}},');
	});

	it('prevents consecutive duplicate insertions', () => {
		const result = smartInsertVariable('Hola {{invitado}}', 17, 17, '{{invitado}}');
		expect(result.newText).toBe('Hola {{invitado}}');
		expect(result.wasDuplicate).toBe(true);
	});
});

describe('getSuggestedPresets', () => {
	it('returns recommended, warm, and brief presets for given eventType', () => {
		const presets = getSuggestedPresets('boda');
		expect(presets).toHaveLength(3);
		expect(presets.map((p) => p.id)).toEqual(['recommended', 'warm', 'brief']);
		expect(presets[0].invitation).toBe(EVENT_SPECIFIC_INVITATION_MESSAGES.boda);
	});
});
