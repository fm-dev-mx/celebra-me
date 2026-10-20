import { getEnv } from '@/lib/server/env';

/** Number a build or render falls back to when CONTACT_WHATSAPP is not configured. */
export const PLACEHOLDER_CONTACT_PHONE = '521000000000';

/** Site route that reads the Worker secret at request time and redirects to wa.me. */
export const WHATSAPP_REDIRECT_PATH = '/api/whatsapp';

/**
 * CONTACT_WHATSAPP is a Worker secret: it exists at request time, never while `astro build`
 * prerenders the home page, so it is read from the runtime environment on every call.
 */
export function getContactPhone(): string {
	return getEnv('CONTACT_WHATSAPP') || PLACEHOLDER_CONTACT_PHONE;
}

export function isPlaceholderContactPhone(phone: string): boolean {
	const digits = phone.replace(/\D/g, '');
	return (
		digits.length < 10 ||
		digits === PLACEHOLDER_CONTACT_PHONE ||
		/^0+$/.test(digits) ||
		digits.includes('0000000000')
	);
}

/** Returns the configured contact number as wa.me digits, or null when it is missing or a placeholder. */
export function resolveContactPhone(raw: string | undefined): string | null {
	const digits = (raw ?? '').replace(/\D/g, '');
	return isPlaceholderContactPhone(digits) ? null : digits;
}

export function buildWaMeUrl(phone: string, message?: string | null): string {
	const text = message ? `?text=${encodeURIComponent(message)}` : '';
	return `https://wa.me/${phone}${text}`;
}

/**
 * Direct wa.me link when the number is known while rendering (server-rendered pages);
 * otherwise the redirect route, so prerendered pages still reach the runtime secret.
 */
export function getWhatsAppLink(message?: string): string {
	const phone = resolveContactPhone(getEnv('CONTACT_WHATSAPP'));
	if (phone) return buildWaMeUrl(phone, message);
	const text = message ? `?text=${encodeURIComponent(message)}` : '';
	return `${WHATSAPP_REDIRECT_PATH}${text}`;
}
