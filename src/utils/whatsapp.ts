const FALLBACK_PHONE = '521000000000';

export function getContactPhone(): string {
	return import.meta.env.CONTACT_WHATSAPP || FALLBACK_PHONE;
}

export function getWhatsAppLink(message?: string): string {
	const phone = getContactPhone();
	const text = message ? `&text=${encodeURIComponent(message)}` : '';
	return `https://wa.me/${phone}${text}`;
}
