import {
	appendGuestMessage,
	formatMessageTimestamp,
	getLatestMessage,
} from '@/lib/rsvp/core/guest-message';

const FIXED_DATE = new Date('2026-06-12T10:34:00-06:00');

describe('formatMessageTimestamp', () => {
	it('formats a date in Spanish CDMX format', () => {
		const result = formatMessageTimestamp(FIXED_DATE);
		expect(result).toBe('12 jun 2026, 10:34');
	});

	it('formats midnight correctly', () => {
		const date = new Date('2026-12-25T00:00:00-06:00');
		expect(formatMessageTimestamp(date)).toBe('25 dic 2026, 00:00');
	});
});

describe('getLatestMessage', () => {
	it('returns empty for empty string', () => {
		expect(getLatestMessage('')).toBe('');
	});

	it('returns the message itself for a plain text entry', () => {
		expect(getLatestMessage('Hola')).toBe('Hola');
	});

	it('strips timestamp from the latest entry', () => {
		const text = 'Hola\n\n[12 jun 2026, 10:34] Adios';
		expect(getLatestMessage(text)).toBe('Adios');
	});

	it('handles multiple entries', () => {
		const text = 'Hola\n\n[12 jun 2026, 10:34] Adios\n\n[18 jun 2026, 21:12] Chao';
		expect(getLatestMessage(text)).toBe('Chao');
	});
});

describe('appendGuestMessage', () => {
	it('stores first message directly', () => {
		expect(appendGuestMessage('', 'Hola', FIXED_DATE)).toBe('Hola');
	});

	it('trims first message whitespace', () => {
		expect(appendGuestMessage('', '  Hola  ', FIXED_DATE)).toBe('Hola');
	});

	it('keeps existing when new message is blank', () => {
		expect(appendGuestMessage('Hola', '', FIXED_DATE)).toBe('Hola');
	});

	it('keeps existing when new message is whitespace only', () => {
		expect(appendGuestMessage('Hola', '   ', FIXED_DATE)).toBe('Hola');
	});

	it('appends a new unique message', () => {
		const result = appendGuestMessage('Hola', 'Adios', FIXED_DATE);
		expect(result).toBe('Hola\n\n[12 jun 2026, 10:34] Adios');
	});

	it('does not append duplicate latest message', () => {
		const existing = 'Hola\n\n[12 jun 2026, 10:34] Adios';
		expect(appendGuestMessage(existing, 'Adios', FIXED_DATE)).toBe(existing);
	});

	it('does not append duplicate with different surrounding whitespace', () => {
		const existing = 'Hola\n\n[12 jun 2026, 10:34] Adios';
		expect(appendGuestMessage(existing, '  Adios  ', FIXED_DATE)).toBe(existing);
	});

	it('appends to legacy plain text', () => {
		const result = appendGuestMessage('Gracias', 'De nada', FIXED_DATE);
		expect(result).toBe('Gracias\n\n[12 jun 2026, 10:34] De nada');
	});

	it('handles multiple sequential appends', () => {
		const step1 = appendGuestMessage('', 'Hola', new Date('2026-06-12T10:00:00-06:00'));
		const step2 = appendGuestMessage(step1, 'A', new Date('2026-06-12T10:01:00-06:00'));
		const step3 = appendGuestMessage(step2, 'B', new Date('2026-06-12T10:02:00-06:00'));

		expect(step3).toBe('Hola\n\n[12 jun 2026, 10:01] A\n\n[12 jun 2026, 10:02] B');
	});
});
