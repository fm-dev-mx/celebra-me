import {
	buildLeadCaptureWhatsAppMessage,
	formatLeadEventDate,
	isLeadEventDateInRange,
} from '@/lib/tracking/lead-capture';

describe('lead capture helpers', () => {
	const today = new Date('2026-10-25T18:00:00.000Z');

	it.each([
		['2026-10-25', true],
		['2026-10-24', true],
		['2029-10-20', true],
		['2026-10-23', false],
		['2030-01-01', false],
		['2026-02-31', false],
		['25/10/2026', false],
	])('checks whether %s is a bookable event date', (value, expected) => {
		expect(isLeadEventDateInRange(value, today)).toBe(expected);
	});

	it('formats the event date in Spanish', () => {
		expect(formatLeadEventDate('2026-10-24')).toBe('24 de octubre de 2026');
		expect(formatLeadEventDate('2027-01-05')).toBe('5 de enero de 2027');
	});

	it('builds the WhatsApp message with the folio line the click tracker recognizes', () => {
		expect(
			buildLeadCaptureWhatsAppMessage({
				contactName: ' Gloria ',
				eventType: 'xv',
				celebrantNames: 'Andrea',
				eventDate: '2026-10-24',
				demoName: 'Lilac',
				leadCode: 'CM-ABC234',
			}),
		).toBe(
			[
				'Hola, soy Gloria. Quiero apartar mi fecha.',
				'Evento: XV años de Andrea, 24 de octubre de 2026.',
				'Me gustó el diseño Lilac.',
				'Folio CM-ABC234',
			].join('\n'),
		);
	});

	it('leaves out the celebrant and the design when they are not given', () => {
		expect(
			buildLeadCaptureWhatsAppMessage({
				contactName: 'Martín',
				eventType: 'boda',
				eventDate: '2027-03-06',
				leadCode: 'CM-XYZ789',
			}),
		).toBe(
			[
				'Hola, soy Martín. Quiero apartar mi fecha.',
				'Evento: Boda, 6 de marzo de 2027.',
				'Folio CM-XYZ789',
			].join('\n'),
		);
	});
});
