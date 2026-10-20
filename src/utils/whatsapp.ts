import { PLACEHOLDER_CONTACT_PHONE } from './contact-phone';

const FALLBACK_PHONE = PLACEHOLDER_CONTACT_PHONE;

export function getContactPhone(): string {
	return import.meta.env.CONTACT_WHATSAPP || FALLBACK_PHONE;
}

export function isPlaceholderContactPhone(phone: string): boolean {
	const digits = phone.replace(/\D/g, '');
	return digits.length === 0 || /^0+$/.test(digits) || digits.includes('0000000000');
}

export function getWhatsAppLink(message?: string): string {
	const phone = getContactPhone();
	const text = message ? `?text=${encodeURIComponent(message)}` : '';
	return `https://wa.me/${phone}${text}`;
}
