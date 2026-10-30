import {
	getDefaultGuestHint,
	getDefaultResponseMessages,
	getDefaultRsvpSubcopy,
	getNamelessResponseTitle,
	resolveLabels,
	validateRsvpForm,
	type RsvpDefaultCopy,
} from '@/components/invitation/rsvp-logic';
import {
	keepsLegacyRsvpDefaults,
	listLegacyRsvpDefaultSlugs,
} from '@/lib/invitation/legacy-rsvp-defaults';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import { tuFormPattern } from '../helpers/tu-register';

const EVENT_TYPES = ['xv', 'boda', 'bautizo', 'cumple', 'baby-shower', 'primera-comunion', 'otro'];

/** Every default string a guest can read, for one register. */
function defaultCopy(copy: RsvpDefaultCopy): string[] {
	const labels = Object.values(resolveLabels(undefined, 'Andrea López', 'standard', copy));
	const editorial = resolveLabels(undefined, 'Andrea', 'editorial', copy).notesPlaceholder;
	const errors = Object.values(
		validateRsvpForm({
			name: '',
			phone: '123',
			phoneRequired: false,
			nameLocked: false,
			attendanceStatus: null,
			attendeeCount: 1,
			supportsPlusOnes: true,
			effectiveGuestCap: 2,
			copy,
		}),
	);
	const missingPhone = validateRsvpForm({
		name: 'Ana',
		phone: '',
		phoneRequired: true,
		nameLocked: false,
		attendanceStatus: 'declined',
		attendeeCount: 0,
		supportsPlusOnes: false,
		effectiveGuestCap: 1,
		copy,
	}).phone;
	const perEvent = EVENT_TYPES.flatMap((eventType) => [
		getDefaultRsvpSubcopy(eventType, copy),
		...(['confirmed', 'declined'] as const).flatMap((status) =>
			Object.values(getDefaultResponseMessages(eventType, status, copy)),
		),
	]);
	return [
		...labels,
		editorial,
		...errors,
		missingPhone ?? '',
		getDefaultGuestHint(copy),
		getNamelessResponseTitle('confirmed', copy),
		getNamelessResponseTitle('declined', copy),
		...perEvent,
	];
}

describe('RSVP default copy', () => {
	it('addresses the guest with «usted» everywhere', () => {
		expect(defaultCopy('usted').filter((text) => tuFormPattern.test(text))).toEqual([]);
	});

	it('does not thank the guest again in the confirmed title', () => {
		const { title, subtitle } = getDefaultResponseMessages('xv', 'confirmed');
		expect(title).toBe('Asistencia confirmada, {guestName}.');
		expect(subtitle).toBe('Su respuesta quedó registrada.');
		expect(getDefaultResponseMessages('boda', 'declined')).toEqual({
			title: 'Sentimos mucho que no pueda acompañarnos, {guestName}.',
			subtitle: 'Gracias por avisarnos.',
		});
		expect(getNamelessResponseTitle('declined')).not.toBe(
			getDefaultResponseMessages('xv', 'declined').subtitle,
		);
	});

	it('keeps the earlier wording word for word on legacy invitations', () => {
		expect(getDefaultResponseMessages('xv', 'confirmed', 'legacy')).toEqual({
			title: '¡Gracias por confirmar, {guestName}!',
			subtitle: 'Tu confirmación ha sido registrada.',
		});
		expect(getDefaultResponseMessages('xv', 'declined', 'legacy')).toEqual({
			title: 'Sentimos mucho que no puedas acompañarnos, {guestName}.',
			subtitle: 'Gracias por avisarnos.',
		});
		expect(getDefaultResponseMessages('primera-comunion', 'confirmed', 'legacy').subtitle).toBe(
			'Tu asistencia ha quedado registrada. Será un honor compartir este día contigo.',
		);
		expect(getNamelessResponseTitle('confirmed', 'legacy')).toBe(
			'¡Gracias por confirmar su asistencia!',
		);
		expect(getDefaultRsvpSubcopy('boda', 'legacy')).toBe(
			'Tu confirmación nos ayuda a preparar cada detalle para compartir este día contigo.',
		);
		expect(getDefaultRsvpSubcopy('otro', 'legacy')).toBe(
			'Tu respuesta nos ayuda a preparar cada detalle de esta celebración especial.',
		);
		expect(resolveLabels(undefined, 'Andrea', 'standard', 'legacy')).toMatchObject({
			nameLabel: 'Tu nombre',
			notesPlaceholder: 'Escribe un mensaje para Andrea...',
		});
		expect(getDefaultGuestHint('legacy')).toBe(
			'Hemos reservado {count} lugares para tu invitación. Puedes ajustar el número si asistirán menos personas.',
		);
		expect(
			validateRsvpForm({
				name: '',
				phone: '',
				phoneRequired: false,
				nameLocked: false,
				attendanceStatus: null,
				attendeeCount: 1,
				supportsPlusOnes: false,
				effectiveGuestCap: 1,
				copy: 'legacy',
			}),
		).toEqual({
			name: 'Por favor, escribe tu nombre completo.',
			attendance: 'Por favor, selecciona si asistirás.',
		});
	});
});

describe('legacy RSVP defaults', () => {
	const definitions = new Map(listInvitationDefinitions().map((d) => [d.slug, d]));
	// Published invitations whose definitions left the repository (invitation-profile-boundary).
	const RETIRED_PUBLISHED = ['america-johana', 'leah-lexa', 'luna-y-estrella', 'xareni-iyarit'];

	it('keeps the published client invitations as they are', () => {
		for (const slug of ['andrea', 'aithan-darell', 'america', ...RETIRED_PUBLISHED]) {
			expect({ slug, legacy: keepsLegacyRsvpDefaults(slug) }).toEqual({ slug, legacy: true });
		}
	});

	it('lists only published invitations', () => {
		for (const slug of listLegacyRsvpDefaultSlugs()) {
			const known =
				definitions.get(slug)?.lifecycle === 'published' ||
				RETIRED_PUBLISHED.includes(slug);
			expect({ slug, known }).toEqual({ slug, known: true });
		}
	});

	it('gives invitations in preparation and demos the new defaults', () => {
		expect(keepsLegacyRsvpDefaults('destenid-sofia')).toBe(false);
		expect(keepsLegacyRsvpDefaults('naydelin-paredes')).toBe(false);
		expect(keepsLegacyRsvpDefaults('demo-xv-jewelry-box')).toBe(false);
		expect(keepsLegacyRsvpDefaults('demo-xv-editorial')).toBe(false);
	});
});
