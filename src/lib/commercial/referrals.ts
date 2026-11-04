import { findMexicanCity } from '@/lib/commercial/mexican-cities';
import { normalizeCommercialPhone } from '@/lib/commercial/phone';

/** Friend discount rate when ordering through a customer referral link (?ref=CODE). */
export const REFERRAL_FRIEND_DISCOUNT_RATE = 0.1;

/** Friend discount percentage (10%). */
export const REFERRAL_FRIEND_DISCOUNT_PERCENT = 10;

/** Credit in MXN awarded to the referring customer for each confirmed/paid referred order. */
export const REFERRAL_REWARD_MXN = 200;

/** Canonical customer referral code pattern (e.g. ANA24, CLB1001). */
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

/** Default public origin used when building customer referral links. */
const DEFAULT_PUBLIC_ORIGIN = 'https://www.celebra-me.com';

export interface ReferralPricingBreakdown {
	basePrice: number;
	discountAmount: number;
	netTotalAmount: number;
}

export interface MetaCustomerCsvInputRow {
	phoneE164?: string | null;
	displayName: string;
	city?: string | null;
	country?: string | null;
}

/**
 * Normalizes a candidate referral code by trimming and uppercasing it.
 * Returns undefined if it does not match the canonical pattern.
 */
export function normalizeReferralCode(raw: unknown): string | undefined {
	if (typeof raw !== 'string') return undefined;
	const cleaned = raw.trim().toUpperCase();
	return REFERRAL_CODE_PATTERN.test(cleaned) ? cleaned : undefined;
}

/**
 * Reads a valid `?ref=CODE` referral code from a URL string.
 */
export function readReferralCodeFromUrl(url: string): string | undefined {
	try {
		const parsed = new URL(url, DEFAULT_PUBLIC_ORIGIN);
		return normalizeReferralCode(parsed.searchParams.get('ref'));
	} catch {
		return undefined;
	}
}

/**
 * Strips accents and non-ASCII letters to produce a short uppercase prefix for a referral code.
 */
export function extractReferralPrefix(displayName: string): string {
	const asciiLetters = displayName
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase()
		.replace(/[^A-Z]/g, '');
	return asciiLetters.length >= 3 ? asciiLetters.slice(0, 4) : 'CLB';
}

/**
 * Generates a human-friendly referral code candidate such as `ANA24`.
 */
export function generateReferralCodeCandidate(displayName: string, digitsSuffix?: string): string {
	const prefix = extractReferralPrefix(displayName);
	const suffix =
		digitsSuffix && /^\d{2,4}$/.test(digitsSuffix)
			? digitsSuffix
			: String(Math.floor(Math.random() * 90) + 10);
	return `${prefix}${suffix}`;
}

/**
 * Calculates the 10% friend discount on an active package price, rounded to whole pesos (integers).
 * Returns the original basePrice, integer discountAmount, and netTotalAmount (`basePrice - discountAmount`).
 */
export function calculateFriendReferralPricing(basePriceMxn: number): ReferralPricingBreakdown {
	const roundedBase = Math.max(1, Math.round(basePriceMxn));
	const maxDiscount = Math.max(0, roundedBase - 1);
	const discountAmount = Math.min(
		maxDiscount,
		Math.max(0, Math.round(roundedBase * REFERRAL_FRIEND_DISCOUNT_RATE)),
	);
	return {
		basePrice: roundedBase,
		discountAmount,
		netTotalAmount: roundedBase - discountAmount,
	};
}

/**
 * Applies accumulated referrer credit ($200 MXN per confirmed friend order) to a new order,
 * keeping a minimum net total of $1 MXN so the order remains a valid positive commercial transaction.
 */
export function applyReferrerCreditPricing(
	basePriceMxn: number,
	availableCreditMxn: number,
): ReferralPricingBreakdown {
	const roundedBase = Math.max(1, Math.round(basePriceMxn));
	const available = Math.max(0, Math.floor(availableCreditMxn));
	const discountAmount = Math.min(available, Math.max(0, roundedBase - 1));
	return {
		basePrice: roundedBase,
		discountAmount,
		netTotalAmount: roundedBase - discountAmount,
	};
}

/**
 * Builds the canonical referral link (`https://www.celebra-me.com/?ref=ANA24`) for a customer.
 */
export function buildCustomerReferralLink(
	referralCode: string,
	origin: string = DEFAULT_PUBLIC_ORIGIN,
): string {
	const normalized = normalizeReferralCode(referralCode) ?? referralCode.trim().toUpperCase();
	const base = origin.trim().replace(/\/+$/, '') || DEFAULT_PUBLIC_ORIGIN;
	return `${base}/?ref=${encodeURIComponent(normalized)}`;
}

/**
 * Builds the WhatsApp message in warm Spanish ("usted" register) from the owner of Celebra-me
 * to share a customer's personal referral link. Tactfully notes that catalog prices have been
 * updated without ever mentioning past promotional prices.
 */
export function buildPastClientReferralWhatsAppMessage(input: {
	customerName?: string | null;
	referralCode: string;
	origin?: string;
}): string {
	const name = input.customerName?.trim();
	const greeting = name ? `Hola, ${name}.` : 'Hola.';
	const link = buildCustomerReferralLink(input.referralCode, input.origin);
	return [
		`${greeting} Le saluda Francisco de Celebra-me. Muchas gracias por habernos permitido ser parte de su celebración.`,
		`Quiero compartirle su enlace personal de recomendación: ${link}`,
		`Ahora contamos con precios actualizados en nuestro catálogo vigente; al compartir su enlace con familiares o amistades, ellos reciben un ${REFERRAL_FRIEND_DISCOUNT_PERCENT} % de descuento sobre el precio actual de su invitación digital y usted acumula $${REFERRAL_REWARD_MXN} MXN de saldo a favor para su próxima invitación por cada pedido confirmado.`,
	].join('\n\n');
}

/**
 * Splits a full customer display name into first name (`fn`) and last name (`ln`) for Meta's
 * Customer List CSV format.
 */
export function splitCustomerNameForMetaCsv(displayName: string): {
	firstName: string;
	lastName: string;
} {
	const parts = displayName.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
	if (parts.length === 0) return { firstName: '', lastName: '' };
	if (parts.length === 1) return { firstName: parts[0], lastName: '' };
	return {
		firstName: parts[0],
		lastName: parts.slice(1).join(' '),
	};
}

function escapeCsvCell(value: string): string {
	const cleaned = value.replace(/\r?\n/g, ' ').trim();
	if (/[",]/.test(cleaned)) {
		return `"${cleaned.replace(/"/g, '""')}"`;
	}
	return cleaned;
}

/**
 * Builds a Meta Ads Customer List CSV (`phone,fn,ln,ct,st,country`) containing only rows with a
 * valid E.164 phone number (`+52...` or `+1...`), deduplicated by E.164 phone. A Mexican city is
 * written under its canonical name with its state; any other city is kept as stored, without state.
 */
export function buildMetaCustomerListCsv(rows: MetaCustomerCsvInputRow[]): string {
	const header = 'phone,fn,ln,ct,st,country';
	const seenPhones = new Set<string>();
	const lines: string[] = [header];

	for (const row of rows) {
		const normalizedPhone = normalizeCommercialPhone(row.phoneE164 ?? undefined);
		if (!normalizedPhone) continue;
		if (seenPhones.has(normalizedPhone.e164)) continue;
		seenPhones.add(normalizedPhone.e164);

		const { firstName, lastName } = splitCustomerNameForMetaCsv(row.displayName);
		const country = (row.country?.trim() || 'MX').toUpperCase();
		const mexicanCity = country === 'MX' ? findMexicanCity(row.city) : undefined;
		const city = mexicanCity?.name ?? row.city?.trim() ?? '';
		const state = mexicanCity?.state ?? '';

		lines.push(
			[
				escapeCsvCell(normalizedPhone.e164),
				escapeCsvCell(firstName),
				escapeCsvCell(lastName),
				escapeCsvCell(city),
				escapeCsvCell(state),
				escapeCsvCell(country),
			].join(','),
		);
	}

	return `${lines.join('\n')}\n`;
}
