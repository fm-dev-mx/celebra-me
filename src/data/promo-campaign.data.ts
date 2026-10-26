/**
 * Single source of truth for the commercial package catalog and the promo calendar.
 *
 * Every price, promo code, campaign code, validity date and WhatsApp quote message shown on the
 * landing page is derived from this module. Do not hardcode those values elsewhere; the guard in
 * `tests/unit/landing-promo-literals.test.ts` enforces it.
 *
 * The module is pure TypeScript (no `import.meta`, no DOM access) so it can be imported by Astro
 * components, client `<script>` bundles and `src/lib/tracking/client.ts` alike.
 *
 * Switching: the landing page (`src/pages/index.astro`) is prerendered with the campaign active on
 * the build day. `PromoStatus.astro` ships this module to the browser, picks the campaign active on
 * the visitor's date and rewrites prices, labels, the countdown and every WhatsApp quote message,
 * so a scheduled row starts and ends on its own dates without a new release. Outside every row the
 * page shows regular prices and the messages carry no promo reference.
 *
 * Prices: every row picks one of the fixed PRICE_TIERS instead of writing its own prices, so the
 * landing page only ever shows the regular, promo or strong price list.
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
	| 'STICKY'
	| 'PROMO';

export const PROMO_CURRENCY = 'MXN';

export type PriceTierId = 'regular' | 'promo' | 'fuerte';

export type PackagePrices = Readonly<Record<PromoPackageId, number>>;

/**
 * Fixed price lists. `regular` applies outside every row and is the struck-through price during
 * one; a row picks `promo` or `fuerte`.
 */
export const PRICE_TIERS: Readonly<Record<PriceTierId, PackagePrices>> = {
	regular: { esencial: 1299, signature: 1799, atelier: 2499 },
	promo: { esencial: 999, signature: 1399, atelier: 1999 },
	fuerte: { esencial: 899, signature: 1299, atelier: 1899 },
};

/**
 * Visual theme of a row. The landing page ships every theme and `html[data-promo-theme]` picks
 * one; the artwork lives in `src/data/promo-theme-art.data.ts`.
 */
export type PromoTheme = 'amor' | 'primavera' | 'verano' | 'patrias' | 'buenfin' | 'temporada';

export const PROMO_THEMES: readonly PromoTheme[] = [
	'amor',
	'primavera',
	'verano',
	'patrias',
	'buenfin',
	'temporada',
];

/** Longest tagline that fits the promo strip on a 360 px screen. */
export const PROMO_TAGLINE_MAX_LENGTH = 60;

export interface CatalogPackage {
	readonly id: PromoPackageId;
	readonly name: string;
	/** Price charged whenever no promo row is active; also the struck-through price during one. */
	readonly regularPrice: number;
}

export interface PromoExtra {
	readonly id: string;
	readonly name: string;
	readonly price: number;
	readonly appliesTo: readonly PromoPackageId[];
}

export interface PromoCampaign {
	readonly id: string;
	readonly label: string;
	readonly codePrefix: string;
	/** Inclusive start instant (ISO-8601, UTC). */
	readonly startsAt: string;
	/** Exclusive end instant (ISO-8601, UTC). */
	readonly endsAt: string;
	/** Human-readable last valid day, used in the validity note. */
	readonly endLabel: string;
	/**
	 * Number of remaining days from which the browser shows "Quedan N días". The countdown only
	 * shows when the starting price goes up once this row ends.
	 */
	readonly countdownDays: number;
	/** Price list charged during the row. */
	readonly tier: PriceTierId;
	/** Visual theme, or null for the default look. */
	readonly theme: PromoTheme | null;
	/** Short phrase for the promo strip, at most PROMO_TAGLINE_MAX_LENGTH characters. */
	readonly tagline: string;
	/** Row-specific conditions listed on the terms page (`src/pages/terminos.astro`). */
	readonly conditions: string;
}

export interface PromoStatus {
	readonly phase: 'active' | 'none';
	readonly campaign: PromoCampaign | null;
	/** Whole days left until the campaign ends, rounded up; 0 when no campaign is active. */
	readonly daysLeft: number;
	readonly showCountdown: boolean;
}

/** Packages in screen order. */
export const PACKAGE_CATALOG: readonly CatalogPackage[] = [
	{ id: 'esencial', name: 'Esencial', regularPrice: PRICE_TIERS.regular.esencial },
	{ id: 'signature', name: 'Signature', regularPrice: PRICE_TIERS.regular.signature },
	{ id: 'atelier', name: 'Atelier', regularPrice: PRICE_TIERS.regular.atelier },
];

const PROMO_EXTRAS: readonly PromoExtra[] = [
	{
		id: 'express-24h',
		name: 'Entrega exprés en 24 horas',
		price: 299,
		appliesTo: ['esencial', 'signature'],
	},
];

/**
 * Promo calendar, ordered by date and renewed every quarter to stay about six months ahead. Dates
 * are anchored to America/Mazatlan (Los Mochis, Sinaloa; UTC-7 with no daylight saving time): each
 * row starts at 00:00 on its first day and ends after 23:59:59 on its last day. Gaps between rows
 * are regular months and show regular prices.
 */
export const PROMO_SCHEDULE: readonly PromoCampaign[] = [
	{
		id: 'octubre-2026',
		label: 'Precio de octubre',
		codePrefix: 'OCTUBRE',
		startsAt: '2026-10-01T07:00:00.000Z',
		endsAt: '2026-11-01T07:00:00.000Z',
		endLabel: '31 de octubre de 2026',
		countdownDays: 7,
		tier: 'promo',
		theme: null,
		tagline: 'Precio especial durante octubre',
		conditions: 'Aplica a los tres paquetes, para eventos de cualquier fecha.',
	},
	{
		id: 'temporada-2026',
		label: 'Precio de temporada',
		codePrefix: 'TEMPORADA',
		startsAt: '2026-11-01T07:00:00.000Z',
		endsAt: '2026-12-16T07:00:00.000Z',
		endLabel: '15 de diciembre de 2026',
		countdownDays: 10,
		tier: 'fuerte',
		theme: 'temporada',
		tagline: 'El mejor precio del año para sus fiestas',
		conditions: 'Aplica a los tres paquetes, para eventos de cualquier fecha.',
	},
	{
		id: 'ano-nuevo-2027',
		label: 'Precio de año nuevo',
		codePrefix: 'NUEVO',
		startsAt: '2026-12-16T07:00:00.000Z',
		endsAt: '2027-02-01T07:00:00.000Z',
		endLabel: '31 de enero de 2027',
		countdownDays: 10,
		tier: 'promo',
		theme: 'temporada',
		tagline: 'Empiece el año con su invitación lista',
		conditions: 'Aplica a los tres paquetes, para eventos de cualquier fecha.',
	},
	{
		id: 'amor-2027',
		label: 'Precio del mes del amor',
		codePrefix: 'AMOR',
		startsAt: '2027-02-01T07:00:00.000Z',
		endsAt: '2027-03-01T07:00:00.000Z',
		endLabel: '28 de febrero de 2027',
		countdownDays: 7,
		tier: 'promo',
		theme: 'amor',
		tagline: 'Celebre el amor con su invitación digital',
		conditions: 'Aplica a los tres paquetes, para bodas y cualquier otro evento.',
	},
	{
		id: 'primavera-2027',
		label: 'Precio de primavera',
		codePrefix: 'PRIMAVERA',
		startsAt: '2027-04-01T07:00:00.000Z',
		endsAt: '2027-05-01T07:00:00.000Z',
		endLabel: '30 de abril de 2027',
		countdownDays: 7,
		tier: 'promo',
		theme: 'primavera',
		tagline: 'Precio de primavera para su evento',
		conditions: 'Aplica a los tres paquetes, para eventos de cualquier fecha.',
	},
	{
		id: 'verano-2027',
		label: 'Precio de verano y graduaciones',
		codePrefix: 'VERANO',
		startsAt: '2027-06-01T07:00:00.000Z',
		endsAt: '2027-07-01T07:00:00.000Z',
		endLabel: '30 de junio de 2027',
		countdownDays: 7,
		tier: 'promo',
		theme: 'verano',
		tagline: 'Graduaciones y fiestas de verano a precio especial',
		conditions: 'Aplica a los tres paquetes, incluidas las graduaciones.',
	},
];

/** Days a quoted price is honored: the price of the day the client writes, if paid within them. */
export const PRICE_HOLD_DAYS = 7;

/** Days of runway left in the calendar below which the weekly check opens a reminder issue. */
export const PROMO_RUNWAY_ALERT_DAYS = 45;

const MS_PER_DAY = 86_400_000;
/** Los Mochis is UTC-7 all year, so its local midnight is 07:00 UTC. */
const LOCAL_MIDNIGHT_UTC_HOUR = 7;
const ENTRY_PACKAGE_ID: PromoPackageId = 'esencial';

/** Formats an amount with thousands separators, independent of the runtime ICU data: `1,399`. */
export function formatMxnAmount(amount: number): string {
	return String(Math.trunc(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Formats an amount with the peso sign: `$1,399`. */
export function formatMxn(amount: number): string {
	return `$${formatMxnAmount(amount)}`;
}

export function getCatalogPackage(id: PromoPackageId): CatalogPackage {
	const pkg = PACKAGE_CATALOG.find((candidate) => candidate.id === id);
	if (!pkg) throw new Error(`Unknown package: ${id}`);
	return pkg;
}

export function getActiveCampaign(now: Date = new Date()): PromoCampaign | null {
	const nowMs = now.getTime();
	return (
		PROMO_SCHEDULE.find(
			(campaign) =>
				nowMs >= Date.parse(campaign.startsAt) && nowMs < Date.parse(campaign.endsAt),
		) ?? null
	);
}

/** Price list charged under a campaign, or the regular one outside every row. */
export function getCampaignPrices(campaign: PromoCampaign | null): PackagePrices {
	return PRICE_TIERS[campaign ? campaign.tier : 'regular'];
}

/** Price charged for a package under a campaign, or its regular price outside every row. */
export function getPackagePrice(id: PromoPackageId, campaign: PromoCampaign | null): number {
	return getCampaignPrices(campaign)[id];
}

/** Promo code whose numeric suffix is the promo price (read by the folio tooling): `NUEVO-899`. */
export function getPromoCode(id: PromoPackageId, campaign: PromoCampaign | null): string | null {
	return campaign ? `${campaign.codePrefix}-${getPackagePrice(id, campaign)}` : null;
}

/** The entry package drives the general "desde" price, code and message. */
export function getGeneralPromoCode(campaign: PromoCampaign | null): string | null {
	return getPromoCode(ENTRY_PACKAGE_ID, campaign);
}

export function getStartingPrice(campaign: PromoCampaign | null): number {
	return getPackagePrice(ENTRY_PACKAGE_ID, campaign);
}

export function getStartingRegularPrice(): number {
	return getCatalogPackage(ENTRY_PACKAGE_ID).regularPrice;
}

/** `<SECTION>-<promo code>` during a campaign, `<SECTION>-REGULAR` outside every row. */
export function buildCampaignCode(section: CampaignSection, promoCode: string | null): string {
	return `${section}-${promoCode ?? 'REGULAR'}`;
}

function withReference(message: string, promoCode: string | null): string {
	return promoCode ? `${message} Ref. ${promoCode}` : message;
}

export function buildGeneralMessage(campaign: PromoCampaign | null): string {
	return withReference(
		'Hola, quiero una invitación digital para mi evento.',
		getGeneralPromoCode(campaign),
	);
}

export function buildPackageMessage(id: PromoPackageId, campaign: PromoCampaign | null): string {
	const pkg = getCatalogPackage(id);
	return withReference(
		`Hola, quiero el paquete ${pkg.name} de ${formatMxn(getPackagePrice(id, campaign))} ${PROMO_CURRENCY}.`,
		getPromoCode(id, campaign),
	);
}

const MONTH_NAMES = [
	'enero',
	'febrero',
	'marzo',
	'abril',
	'mayo',
	'junio',
	'julio',
	'agosto',
	'septiembre',
	'octubre',
	'noviembre',
	'diciembre',
];

/** First valid day of a campaign in Los Mochis, written like `endLabel`: `1 de febrero de 2027`. */
export function getStartLabel(campaign: PromoCampaign): string {
	const localDay = new Date(Date.parse(campaign.startsAt) - LOCAL_MIDNIGHT_UTC_HOUR * 3_600_000);
	return `${localDay.getUTCDate()} de ${MONTH_NAMES[localDay.getUTCMonth()]} de ${localDay.getUTCFullYear()}`;
}

export function getValidityNote(campaign: PromoCampaign): string {
	return `${campaign.label}, válido hasta el ${campaign.endLabel}.`;
}

export function getExpressDelivery(): PromoExtra {
	const extra = PROMO_EXTRAS.find((candidate) => candidate.id === 'express-24h');
	if (!extra) throw new Error('Missing express delivery extra');
	return extra;
}

/** Starting price charged right after a campaign ends: the next row's, or the regular price. */
function getStartingPriceAfter(campaign: PromoCampaign): number {
	const next = PROMO_SCHEDULE.find((candidate) => candidate.startsAt === campaign.endsAt);
	return getStartingPrice(next ?? null);
}

export function getPromoStatus(now: Date = new Date()): PromoStatus {
	const campaign = getActiveCampaign(now);
	if (!campaign) return { phase: 'none', campaign: null, daysLeft: 0, showCountdown: false };

	const daysLeft = Math.max(
		1,
		Math.ceil((Date.parse(campaign.endsAt) - now.getTime()) / MS_PER_DAY),
	);
	const priceGoesUp = getStartingPriceAfter(campaign) > getStartingPrice(campaign);
	return {
		phase: 'active',
		campaign,
		daysLeft,
		showCountdown: priceGoesUp && daysLeft <= campaign.countdownDays,
	};
}

/**
 * Campaign the prerendered HTML is built with: the active one, else the next scheduled one, so a
 * build made in a gap right before a row still ships its labels. The browser corrects the state.
 */
export function getRenderCampaign(now: Date = new Date()): PromoCampaign | null {
	return (
		getActiveCampaign(now) ??
		PROMO_SCHEDULE.find((campaign) => Date.parse(campaign.startsAt) > now.getTime()) ??
		null
	);
}

export function formatDaysLeft(daysLeft: number): string {
	return daysLeft === 1 ? 'Queda 1 día' : `Quedan ${daysLeft} días`;
}

/** Last instant covered by the calendar and the whole days left until then (0 once past). */
export function getScheduleRunway(
	now: Date = new Date(),
): { endsAt: string; endLabel: string; daysLeft: number } | null {
	const last = PROMO_SCHEDULE.at(-1);
	if (!last) return null;
	const daysLeft = Math.max(0, Math.ceil((Date.parse(last.endsAt) - now.getTime()) / MS_PER_DAY));
	return { endsAt: last.endsAt, endLabel: last.endLabel, daysLeft };
}

/**
 * Instant a `?fecha=AAAA-MM-DD` preview stands for: 00:00 of that day in Los Mochis. Null when the
 * parameter is missing or is not a real calendar date. Callers decide whether previews are allowed.
 */
export function parsePromoPreviewDate(search: string): Date | null {
	const value = new URLSearchParams(search).get('fecha') ?? '';
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const [year, month, day] = match.slice(1).map(Number);
	const date = new Date(Date.UTC(year, month - 1, day, LOCAL_MIDNIGHT_UTC_HOUR));
	const isRealDate =
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day;
	return isRealDate ? date : null;
}

export function isPromoTheme(value: string): value is PromoTheme {
	return (PROMO_THEMES as readonly string[]).includes(value);
}

/**
 * Theme a `?tema=<theme>` preview asks for, or null. It only restyles an active row (prices and
 * labels stay the row's), so themes without a calendar row can still be reviewed. Callers decide
 * whether previews are allowed.
 */
export function parsePromoThemePreview(search: string): PromoTheme | null {
	const value = new URLSearchParams(search).get('tema') ?? '';
	return isPromoTheme(value) ? value : null;
}

/** Theme drawn for a campaign: the preview override during a row, else the row's own theme. */
export function getCampaignTheme(
	campaign: PromoCampaign | null,
	previewTheme: PromoTheme | null = null,
): PromoTheme | null {
	if (!campaign) return null;
	return previewTheme ?? campaign.theme;
}

/** Share image (1200x630) for a theme, or null for the default landing image. */
export function getPromoShareImage(theme: PromoTheme | null): string | null {
	return theme ? `/images/og/og-promo-${theme}.jpg` : null;
}

/**
 * Calendar problems (empty when valid): order, overlaps, codes, tiers, themes and copy. Unknown
 * tiers and themes cannot pass the type checker, but a cast row still has to fail here.
 */
export function validatePromoSchedule(
	schedule: readonly PromoCampaign[] = PROMO_SCHEDULE,
): string[] {
	const problems: string[] = [];
	const codes = new Set<string>();
	const tierIds = Object.keys(PRICE_TIERS);
	schedule.forEach((campaign, index) => {
		const start = Date.parse(campaign.startsAt);
		const end = Date.parse(campaign.endsAt);
		if (!(start < end)) problems.push(`${campaign.id}: startsAt must be before endsAt`);
		const previous = schedule[index - 1];
		if (previous && start < Date.parse(previous.startsAt)) {
			problems.push(`${campaign.id}: out of order after ${previous.id}`);
		}
		for (const other of schedule.slice(0, index)) {
			if (start < Date.parse(other.endsAt) && Date.parse(other.startsAt) < end) {
				problems.push(`${campaign.id}: overlaps ${other.id}`);
			}
		}
		if (!/^[A-Z]+$/.test(campaign.codePrefix)) {
			problems.push(`${campaign.id}: codePrefix must be uppercase letters`);
		}
		if (codes.has(campaign.codePrefix)) problems.push(`${campaign.id}: duplicate codePrefix`);
		codes.add(campaign.codePrefix);
		if (!tierIds.includes(campaign.tier)) {
			problems.push(`${campaign.id}: unknown tier ${String(campaign.tier)}`);
		} else {
			for (const pkg of PACKAGE_CATALOG) {
				const price = PRICE_TIERS[campaign.tier][pkg.id];
				if (!(Number.isInteger(price) && price > 0 && price < pkg.regularPrice)) {
					problems.push(
						`${campaign.id}: ${pkg.id} promo price must be below ${pkg.regularPrice}`,
					);
				}
			}
		}
		if (campaign.theme !== null && !isPromoTheme(campaign.theme)) {
			problems.push(`${campaign.id}: unknown theme ${String(campaign.theme)}`);
		}
		const tagline = campaign.tagline.trim();
		if (tagline === '' || tagline.length > PROMO_TAGLINE_MAX_LENGTH) {
			problems.push(
				`${campaign.id}: tagline must have 1-${PROMO_TAGLINE_MAX_LENGTH} characters`,
			);
		}
		if (campaign.conditions.trim() === '') problems.push(`${campaign.id}: missing conditions`);
	});
	return problems;
}
