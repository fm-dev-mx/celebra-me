import {
	buildCampaignCode,
	buildGeneralMessage,
	buildPackageMessage,
	formatDaysLeft,
	formatMxn,
	formatMxnAmount,
	getExpressDelivery,
	getGeneralPromoCode,
	getPromoCode,
	getPromoPackage,
	getPromoStatus,
	getStartingPrice,
	getValidityNote,
	PROMO_CAMPAIGN,
} from '@/data/promo-campaign.data';

/** Local wall-clock time in Los Mochis (America/Mazatlan, UTC-7, no daylight saving time). */
const losMochis = (localDateTime: string) => new Date(`${localDateTime}-07:00`);

describe('promo campaign catalog', () => {
	it('lists the packages in screen order with regular prices above promo prices', () => {
		expect(PROMO_CAMPAIGN.packages.map((pkg) => pkg.id)).toEqual([
			'esencial',
			'signature',
			'atelier',
		]);
		for (const pkg of PROMO_CAMPAIGN.packages) {
			expect(pkg.regularPrice).toBeGreaterThan(pkg.promoPrice);
		}
	});

	it('encodes the promo price as the numeric suffix of each promo code', () => {
		for (const pkg of PROMO_CAMPAIGN.packages) {
			const code = getPromoCode(pkg);
			expect(code.startsWith(`${PROMO_CAMPAIGN.codePrefix}-`)).toBe(true);
			expect(Number(code.match(/(\d+)$/)?.[1])).toBe(pkg.promoPrice);
		}
	});

	it('uses the entry package for the general code, price and campaign codes', () => {
		const entry = PROMO_CAMPAIGN.packages[0];
		expect(getStartingPrice()).toBe(entry.promoPrice);
		expect(getGeneralPromoCode()).toBe(getPromoCode(entry));
		expect(buildCampaignCode('HERO')).toBe(`HERO-${getPromoCode(entry)}`);
		expect(buildCampaignCode('PRICING', getPromoCode(PROMO_CAMPAIGN.packages[1]))).toBe(
			`PRICING-${getPromoCode(PROMO_CAMPAIGN.packages[1])}`,
		);
	});

	it('limits the express delivery extra to Esencial and Signature', () => {
		expect(getExpressDelivery().appliesTo).toEqual(['esencial', 'signature']);
		expect(() => getPromoPackage('atelier')).not.toThrow();
	});
});

describe('promo campaign copy', () => {
	it('formats peso amounts without depending on ICU data', () => {
		expect(formatMxnAmount(999)).toBe('999');
		expect(formatMxnAmount(12345)).toBe('12,345');
		expect(formatMxn(1250)).toBe('$1,250');
	});

	it('builds the general and per-package WhatsApp messages with a single reference', () => {
		const code = getGeneralPromoCode();
		expect(buildGeneralMessage()).toBe(
			`Hola, quiero una invitación digital para mi evento. Ref. ${code}`,
		);

		const signature = getPromoPackage('signature');
		expect(buildPackageMessage(signature)).toBe(
			`Hola, quiero el paquete Signature de ${formatMxn(signature.promoPrice)} MXN. Ref. ${getPromoCode(signature)}`,
		);
	});

	it('states the validity note with the last valid day', () => {
		expect(getValidityNote()).toBe(
			`${PROMO_CAMPAIGN.label}, válido hasta el ${PROMO_CAMPAIGN.endLabel}.`,
		);
	});

	it('pluralizes the remaining-days label', () => {
		expect(formatDaysLeft(1)).toBe('Queda 1 día');
		expect(formatDaysLeft(5)).toBe('Quedan 5 días');
	});
});

describe('promo campaign status', () => {
	it('is upcoming before the first day in Los Mochis', () => {
		expect(getPromoStatus(losMochis('2026-09-30T23:59:59'))).toEqual({
			phase: 'upcoming',
			daysLeft: 0,
			showCountdown: false,
		});
	});

	it('is active without a countdown early in the month', () => {
		expect(getPromoStatus(losMochis('2026-10-01T00:00:00')).phase).toBe('active');
		const midMonth = getPromoStatus(losMochis('2026-10-15T12:00:00'));
		expect(midMonth.phase).toBe('active');
		expect(midMonth.showCountdown).toBe(false);
	});

	it('shows the countdown during the last seven days', () => {
		expect(getPromoStatus(losMochis('2026-10-24T23:00:00')).showCountdown).toBe(false);

		const firstCountdownDay = getPromoStatus(losMochis('2026-10-25T12:00:00'));
		expect(firstCountdownDay).toEqual({ phase: 'active', daysLeft: 7, showCountdown: true });

		const lastDay = getPromoStatus(losMochis('2026-10-31T23:00:00'));
		expect(lastDay).toEqual({ phase: 'active', daysLeft: 1, showCountdown: true });
		expect(formatDaysLeft(lastDay.daysLeft)).toBe('Queda 1 día');
	});

	it('expires after the last day in Los Mochis', () => {
		expect(getPromoStatus(losMochis('2026-11-01T00:00:01'))).toEqual({
			phase: 'expired',
			daysLeft: 0,
			showCountdown: false,
		});
	});
});
