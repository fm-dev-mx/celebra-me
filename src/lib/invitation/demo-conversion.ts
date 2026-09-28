import { getWhatsAppLink } from '@/utils/whatsapp';

export const CELESTIAL_DEMO_SLUG = 'demo-xv-celestial-blue';
export const CELESTIAL_QUOTE_MESSAGE =
	'Hola, revisé la demo XV Celestial Blue y quisiera cotizar una invitación basada en este estilo.';

/** Commercial composition is opt-in at the public page, never a section renderer decision. */
export function hasDemoConversion(slug: string, isDemo: boolean): boolean {
	return isDemo && slug === CELESTIAL_DEMO_SLUG;
}

export function getCelestialQuoteLink(): string {
	return getWhatsAppLink(CELESTIAL_QUOTE_MESSAGE);
}
