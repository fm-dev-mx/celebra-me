import type { APIContext } from 'astro';

jest.unmock('@/utils/whatsapp');

import { GET } from '@/pages/api/whatsapp';
import {
	getContactPhone,
	getWhatsAppLink,
	isPlaceholderContactPhone,
	resolveContactPhone,
} from '@/utils/whatsapp';

const REAL_PHONE = '5216681234567';

function callRedirect(search = ''): Promise<Response> | Response {
	const url = new URL(`https://www.celebra-me.com/api/whatsapp${search}`);
	return GET({ url } as unknown as APIContext);
}

describe('WhatsApp contact number', () => {
	const original = process.env.CONTACT_WHATSAPP;
	afterEach(() => {
		if (original === undefined) delete process.env.CONTACT_WHATSAPP;
		else process.env.CONTACT_WHATSAPP = original;
	});

	it('treats a missing number and the 521000000000 placeholder as not configured', () => {
		for (const raw of [undefined, '', '521000000000', '+52 1 000 000 000', '0000000000']) {
			expect(resolveContactPhone(raw)).toBeNull();
		}
		expect(isPlaceholderContactPhone('521000000000')).toBe(true);
		expect(resolveContactPhone('+52 1 668 123 4567')).toBe(REAL_PHONE);
	});

	it('reads the runtime secret, so server-rendered pages link wa.me directly', () => {
		process.env.CONTACT_WHATSAPP = REAL_PHONE;
		expect(getContactPhone()).toBe(REAL_PHONE);
		expect(getWhatsAppLink('Hola')).toBe(`https://wa.me/${REAL_PHONE}?text=Hola`);
	});

	it('points prerendered pages at the redirect route when the number is unknown at build', () => {
		delete process.env.CONTACT_WHATSAPP;
		expect(getWhatsAppLink('Hola y adiós')).toBe('/api/whatsapp?text=Hola%20y%20adi%C3%B3s');
		expect(getWhatsAppLink()).toBe('/api/whatsapp');
	});

	it('redirects to wa.me with the configured number and only the text parameter', async () => {
		process.env.CONTACT_WHATSAPP = REAL_PHONE;
		const response = await callRedirect('?text=Hola%20%C2%BFprecio%3F&to=https://evil.example');
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe(
			`https://wa.me/${REAL_PHONE}?text=Hola%20%C2%BFprecio%3F`,
		);
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('answers 503 instead of redirecting to the placeholder number', async () => {
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		for (const value of [undefined, '521000000000']) {
			if (value === undefined) delete process.env.CONTACT_WHATSAPP;
			else process.env.CONTACT_WHATSAPP = value;
			const response = await callRedirect('?text=Hola');
			expect(response.status).toBe(503);
			expect(response.headers.has('location')).toBe(false);
		}
	});
});
