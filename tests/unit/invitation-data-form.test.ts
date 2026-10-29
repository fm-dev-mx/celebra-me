import { parseInvitationDataAnswers } from '@/lib/invitation-data/answers-schema';
import {
	buildInvitationDataWhatsAppMessage,
	compactInvitationDataAnswers,
	findMissingRequiredFields,
	INVITATION_DATA_FIELD_NAMES,
	INVITATION_DATA_FIELDS,
	INVITATION_DATA_STEPS,
	suggestMainMessages,
} from '@/lib/invitation-data/form';

describe('invitation data form definition', () => {
	it('lists every field exactly once across the steps', () => {
		const names = INVITATION_DATA_FIELDS.map((field) => field.name);
		expect(new Set(names).size).toBe(names.length);
		expect([...names].sort()).toEqual([...INVITATION_DATA_FIELD_NAMES].sort());
		expect(INVITATION_DATA_STEPS.every((step) => step.fields.length > 0)).toBe(true);
	});

	it('requires only the celebrant names and the event date to send', () => {
		expect(
			INVITATION_DATA_FIELDS.filter((field) => field.requiredToSubmit).map(
				(field) => field.name,
			),
		).toEqual(['celebrantNames', 'eventDate']);
		expect(findMissingRequiredFields({ celebrantNames: '  ' })).toEqual({
			celebrantNames: expect.any(String),
			eventDate: expect.any(String),
		});
		expect(
			findMissingRequiredFields({ celebrantNames: 'Andrea', eventDate: '2026-12-12' }),
		).toEqual({});
	});

	it('offers main message suggestions per event type', () => {
		expect(suggestMainMessages('xv').length).toBeGreaterThan(0);
		expect(suggestMainMessages('boda').length).toBeGreaterThan(0);
		expect(suggestMainMessages('desconocido')).toEqual([]);
		expect(suggestMainMessages(null)).toEqual([]);
	});

	it('drops empty answers when compacting and preserves photos', () => {
		const photo = {
			id: '11111111-1111-4111-8111-111111111111',
			url: 'https://cdn.celebra-me.com/photo.jpg',
			name: 'foto.jpg',
			size: 2048,
			type: 'image/jpeg',
		};
		expect(
			compactInvitationDataAnswers({
				celebrantNames: ' Andrea ',
				parents: '',
				song: '   ',
				photos: [photo],
			}),
		).toEqual({ celebrantNames: 'Andrea', photos: [photo] });
	});

	it('builds the WhatsApp message with the first name and the link', () => {
		const message = buildInvitationDataWhatsAppMessage({
			customerName: 'Gloria Garza',
			link: 'https://www.celebra-me.com/mi-invitacion/abc',
		});
		expect(message.startsWith('Hola, Gloria.')).toBe(true);
		expect(message).toContain('https://www.celebra-me.com/mi-invitacion/abc');
		expect(message).toContain('fotos');
		expect(buildInvitationDataWhatsAppMessage({ customerName: null, link: 'x' })).toMatch(
			/^Hola\./u,
		);
	});
});

describe('parseInvitationDataAnswers', () => {
	it('accepts a partial draft and trims it', () => {
		expect(
			parseInvitationDataAnswers({
				celebrantNames: ' Andrea ',
				eventDate: '2026-12-12',
				ceremonyTime: '19:30',
				ceremonyMapUrl: 'https://maps.app.goo.gl/abc',
				parents: '',
			}),
		).toEqual({
			ok: true,
			answers: {
				celebrantNames: 'Andrea',
				eventDate: '2026-12-12',
				ceremonyTime: '19:30',
				ceremonyMapUrl: 'https://maps.app.goo.gl/abc',
			},
		});
	});

	it('reports invalid dates, times and links per field', () => {
		const result = parseInvitationDataAnswers({
			eventDate: '2026-02-30',
			receptionTime: '25:00',
			receptionMapUrl: 'javascript:alert(1)',
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(Object.keys(result.issues).sort()).toEqual([
			'eventDate',
			'receptionMapUrl',
			'receptionTime',
		]);
	});

	it('rejects text over the field limit', () => {
		const result = parseInvitationDataAnswers({ celebrantNames: 'a'.repeat(121) });
		expect(result).toEqual({ ok: false, issues: { celebrantNames: expect.any(String) } });
	});

	it('rejects unknown fields and non-string values', () => {
		expect(parseInvitationDataAnswers({ photos: 'x' }).ok).toBe(false);
		expect(parseInvitationDataAnswers({ celebrantNames: 5 }).ok).toBe(false);
		expect(parseInvitationDataAnswers(null).ok).toBe(false);
		expect(parseInvitationDataAnswers({ unknownField: 'val' }).ok).toBe(false);
	});

	it('accepts and validates photos', () => {
		const validPhoto = {
			id: '11111111-1111-4111-8111-111111111111',
			url: 'https://cdn.celebra-me.com/photo.jpg',
			name: 'foto.jpg',
			size: 2048,
			type: 'image/jpeg',
		};
		const result = parseInvitationDataAnswers({
			celebrantNames: 'Andrea',
			photos: [validPhoto],
		});
		expect(result).toEqual({
			ok: true,
			answers: { celebrantNames: 'Andrea', photos: [validPhoto] },
		});

		const invalidMime = parseInvitationDataAnswers({
			photos: [{ ...validPhoto, type: 'application/pdf' }],
		});
		expect(invalidMime.ok).toBe(false);

		const elevenPhotos = Array.from({ length: 11 }, () => validPhoto);
		const tooMany = parseInvitationDataAnswers({
			photos: elevenPhotos,
		});
		expect(tooMany.ok).toBe(false);
	});
});
