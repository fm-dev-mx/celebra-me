/**
 * Single source of truth for the commercial package catalog and the active promo campaign.
 *
 * Every price, promo code, campaign code, validity date and WhatsApp quote message shown on the
 * landing page is derived from this module. Do not hardcode those values elsewhere; the guard in
 * `tests/unit/landing-promo-literals.test.ts` enforces it.
 *
 * The module is pure TypeScript (no `import.meta`, no DOM access) so it can be imported by Astro
 * components, client `<script>` bundles and `src/lib/tracking/client.ts` alike.
 *
 * Expiry: the landing page (`src/pages/index.astro`) is prerendered at build time, so nothing here
 * expires server-side. After `endsAt`, `PromoStatus.astro` hides promo-only markup in the browser;
 * the promo codes embedded in WhatsApp messages remain until this module is edited and the site is
 * rebuilt and published again.
 */

export type PromoPackageId = 'esencial' | 'signature' | 'atelier';

/** Section prefix used to build campaign codes: `<SECTION>-<promo code>`. */
export type CampaignSection =
	| 'HEADER'
	| 'HERO'
	| 'DEMO'
	| 'PROOF'
	| 'SERVICES'
	| 'GUESTS'
	| 'PROCESS'
	| 'PRICING'
	| 'FINAL'
	| 'FOOTER'
	| 'STICKY';

export interface PromoPackage {
	readonly id: PromoPackageId;
	readonly name: string;
	readonly promoPrice: number;
	readonly regularPrice: number;
}

export interface PromoExtra {
	readonly id: string;
	readonly name: string;
	readonly price: number;
	readonly appliesTo: readonly PromoPackageId[];
}

export interface PromoCampaign {
	readonly label: string;
	readonly codePrefix: string;
	readonly currency: 'MXN';
	/** Inclusive start instant (ISO-8601, UTC). */
	readonly startsAt: string;
	/** Exclusive end instant (ISO-8601, UTC). */
	readonly endsAt: string;
	/** Human-readable last valid day, used in the validity note. */
	readonly endLabel: string;
	/** Number of remaining days from which the browser shows "Quedan N días". */
	readonly countdownDays: number;
	readonly packages: readonly PromoPackage[];
	readonly extras: readonly PromoExtra[];
}

export type PromoPhase = 'upcoming' | 'active' | 'expired';

export interface PromoStatus {
	readonly phase: PromoPhase;
	/** Whole days left until `endsAt`, rounded up; 0 when the promo is not active. */
	readonly daysLeft: number;
	readonly showCountdown: boolean;
}

/**
 * October 2026 pricing. Dates are anchored to America/Mazatlan (Los Mochis, Sinaloa; UTC-7 with
 * no daylight saving time): valid from 1 October 00:00 through 31 October 23:59:59 inclusive.
 */
export const PROMO_CAMPAIGN: PromoCampaign = {
	label: 'Precio de octubre',
	codePrefix: 'OCTUBRE',
	currency: 'MXN',
	startsAt: '2026-10-01T07:00:00.000Z',
	endsAt: '2026-11-01T07:00:00.000Z',
	endLabel: '31 de octubre de 2026',
	countdownDays: 7,
	packages: [
		{ id: 'esencial', name: 'Esencial', promoPrice: 999, regularPrice: 1299 },
		{ id: 'signature', name: 'Signature', promoPrice: 1399, regularPrice: 1799 },
		{ id: 'atelier', name: 'Atelier', promoPrice: 1999, regularPrice: 2499 },
	],
	extras: [
		{
			id: 'express-24h',
			name: 'Entrega exprés en 24 horas',
			price: 299,
			appliesTo: ['esencial', 'signature'],
		},
	],
};

const MS_PER_DAY = 86_400_000;

/** Formats an amount with thousands separators, independent of the runtime ICU data: `1,399`. */
export function formatMxnAmount(amount: number): string {
	return String(Math.trunc(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Formats an amount with the peso sign: `$1,399`. */
export function formatMxn(amount: number): string {
	return `$${formatMxnAmount(amount)}`;
}

export function getPromoPackage(id: PromoPackageId): PromoPackage {
	const pkg = PROMO_CAMPAIGN.packages.find((candidate) => candidate.id === id);
	if (!pkg) throw new Error(`Unknown promo package: ${id}`);
	return pkg;
}

/** Promo code whose numeric suffix is the promo price (read by the folio tooling): `OCTUBRE-999`. */
export function getPromoCode(pkg: PromoPackage): string {
	return `${PROMO_CAMPAIGN.codePrefix}-${pkg.promoPrice}`;
}

/** The entry package drives the general "desde" price, code and message. */
export function getStartingPackage(): PromoPackage {
	return PROMO_CAMPAIGN.packages.reduce((lowest, pkg) =>
		pkg.promoPrice < lowest.promoPrice ? pkg : lowest,
	);
}

export function getGeneralPromoCode(): string {
	return getPromoCode(getStartingPackage());
}

export function getStartingPrice(): number {
	return getStartingPackage().promoPrice;
}

export function getStartingRegularPrice(): number {
	return getStartingPackage().regularPrice;
}

export function buildCampaignCode(section: CampaignSection, code = getGeneralPromoCode()): string {
	return `${section}-${code}`;
}

export function buildGeneralMessage(): string {
	return `Hola, quiero una invitación digital para mi evento. Ref. ${getGeneralPromoCode()}`;
}

export function buildPackageMessage(pkg: PromoPackage): string {
	return `Hola, quiero el paquete ${pkg.name} de ${formatMxn(pkg.promoPrice)} MXN. Ref. ${getPromoCode(pkg)}`;
}

export function getValidityNote(): string {
	return `${PROMO_CAMPAIGN.label}, válido hasta el ${PROMO_CAMPAIGN.endLabel}.`;
}

export function getExpressDelivery(): PromoExtra {
	const extra = PROMO_CAMPAIGN.extras.find((candidate) => candidate.id === 'express-24h');
	if (!extra) throw new Error('Missing express delivery extra');
	return extra;
}

export function getPromoStatus(now: Date = new Date()): PromoStatus {
	const nowMs = now.getTime();
	const startMs = Date.parse(PROMO_CAMPAIGN.startsAt);
	const endMs = Date.parse(PROMO_CAMPAIGN.endsAt);

	if (nowMs >= endMs) return { phase: 'expired', daysLeft: 0, showCountdown: false };
	if (nowMs < startMs) return { phase: 'upcoming', daysLeft: 0, showCountdown: false };

	const daysLeft = Math.max(1, Math.ceil((endMs - nowMs) / MS_PER_DAY));
	return {
		phase: 'active',
		daysLeft,
		showCountdown: daysLeft <= PROMO_CAMPAIGN.countdownDays,
	};
}

export function formatDaysLeft(daysLeft: number): string {
	return daysLeft === 1 ? 'Queda 1 día' : `Quedan ${daysLeft} días`;
}
