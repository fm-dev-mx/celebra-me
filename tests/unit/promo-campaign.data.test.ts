import {
	buildCampaignCode,
	buildGeneralMessage,
	buildPackageMessage,
	formatDaysLeft,
	formatMxn,
	formatMxnAmount,
	getActiveCampaign,
	getExpressDelivery,
	getGeneralPromoCode,
	getPackagePrice,
	getPromoCode,
	getPromoStatus,
	getRenderCampaign,
	getScheduleRunway,
	getStartLabel,
	getStartingPrice,
	getStartingRegularPrice,
	getValidityNote,
	PACKAGE_CATALOG,
	parsePromoPreviewDate,
	PRICE_TIERS,
	PROMO_RUNWAY_ALERT_DAYS,
	PROMO_SCHEDULE,
	PROMO_TAGLINE_MAX_LENGTH,
	validatePromoSchedule,
	type PromoCampaign,
} from '@/data/promo-campaign.data';

/** Local wall-clock time in Los Mochis (America/Mazatlan, UTC-7, no daylight saving time). */
const losMochis = (localDateTime: string) => new Date(`${localDateTime}-07:00`);

const campaign = (id: string): PromoCampaign => {
	const found = PROMO_SCHEDULE.find((candidate) => candidate.id === id);
	if (!found) throw new Error(`Missing campaign ${id}`);
	return found;
};

const MONTHS = [
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

describe('promo calendar', () => {
	it('is ordered, without overlaps, with unique codes and promo prices below regular', () => {
		expect(validatePromoSchedule()).toEqual([]);
	});

	it('reports overlapping rows and tiers that do not lower the regular price', () => {
		const [first] = PROMO_SCHEDULE;
		const problems = validatePromoSchedule([first, { ...first, id: 'clash', tier: 'regular' }]);
		expect(problems).toEqual(
			expect.arrayContaining([
				'clash: overlaps octubre-2026',
				'clash: duplicate codePrefix',
				'clash: esencial promo price must be below 1299',
				'clash: atelier promo price must be below 2499',
			]),
		);
	});

	it('reports overlaps with any earlier row and rows out of order', () => {
		const [october, season, newYear] = PROMO_SCHEDULE;
		const longOctober = { ...october, endsAt: newYear.endsAt };
		expect(validatePromoSchedule([longOctober, season, newYear])).toEqual([
			'temporada-2026: overlaps octubre-2026',
			'ano-nuevo-2027: overlaps octubre-2026',
		]);
		expect(validatePromoSchedule([season, october])).toEqual([
			'octubre-2026: out of order after temporada-2026',
		]);
	});

	it('reports unknown tiers and themes, bad codes and missing copy', () => {
		const [first] = PROMO_SCHEDULE;
		const broken = {
			...first,
			codePrefix: 'oct-1',
			tier: 'gratis',
			theme: 'halloween',
			tagline: 'x'.repeat(PROMO_TAGLINE_MAX_LENGTH + 1),
			conditions: ' ',
		} as unknown as PromoCampaign;
		expect(validatePromoSchedule([broken])).toEqual([
			'octubre-2026: codePrefix must be uppercase letters',
			'octubre-2026: unknown tier gratis',
			'octubre-2026: unknown theme halloween',
			`octubre-2026: tagline must have 1-${PROMO_TAGLINE_MAX_LENGTH} characters`,
			'octubre-2026: missing conditions',
		]);
		expect(validatePromoSchedule([{ ...first, theme: null, tagline: '' }])).toEqual([
			`octubre-2026: tagline must have 1-${PROMO_TAGLINE_MAX_LENGTH} characters`,
		]);
	});

	it('covers about six months ahead, through 30 June 2027', () => {
		expect(PROMO_SCHEDULE.at(-1)?.endLabel).toBe('30 de junio de 2027');
	});

	it('writes each start day like the end labels', () => {
		expect(getStartLabel(campaign('ano-nuevo-2027'))).toBe('16 de diciembre de 2026');
		expect(getStartLabel(campaign('amor-2027'))).toBe('1 de febrero de 2027');
	});

	it('labels each row with its last valid day in Los Mochis', () => {
		for (const row of PROMO_SCHEDULE) {
			const lastDay = new Date(Date.parse(row.endsAt) - 7 * 3_600_000 - 1);
			expect(row.endLabel).toBe(
				`${lastDay.getUTCDate()} de ${MONTHS[lastDay.getUTCMonth()]} de ${lastDay.getUTCFullYear()}`,
			);
		}
	});

	it('picks the row of each local day and nothing outside the calendar', () => {
		expect(getActiveCampaign(losMochis('2026-09-30T23:59:59'))).toBeNull();
		expect(getActiveCampaign(losMochis('2026-10-31T23:59:59'))?.id).toBe('octubre-2026');
		expect(getActiveCampaign(losMochis('2026-11-01T00:00:00'))?.id).toBe('temporada-2026');
		expect(getActiveCampaign(losMochis('2026-12-15T23:59:59'))?.id).toBe('temporada-2026');
		expect(getActiveCampaign(losMochis('2026-12-16T00:00:00'))?.id).toBe('ano-nuevo-2027');
		expect(getActiveCampaign(losMochis('2027-02-01T00:00:00'))?.id).toBe('amor-2027');
		expect(getActiveCampaign(losMochis('2027-02-28T23:59:59'))?.id).toBe('amor-2027');
		expect(getActiveCampaign(losMochis('2027-07-01T00:00:00'))).toBeNull();
	});

	it('leaves March and May as regular months between promos', () => {
		expect(getActiveCampaign(losMochis('2027-03-01T00:00:00'))).toBeNull();
		expect(getActiveCampaign(losMochis('2027-03-31T23:59:59'))).toBeNull();
		expect(getActiveCampaign(losMochis('2027-04-01T00:00:00'))?.id).toBe('primavera-2027');
		expect(getActiveCampaign(losMochis('2027-05-15T12:00:00'))).toBeNull();
		expect(getActiveCampaign(losMochis('2027-06-01T00:00:00'))?.id).toBe('verano-2027');
		expect(getActiveCampaign(losMochis('2027-06-30T23:59:59'))?.id).toBe('verano-2027');
	});

	it('builds with the active row, else the next one, else none', () => {
		expect(getRenderCampaign(losMochis('2026-11-20T12:00:00'))?.id).toBe('temporada-2026');
		expect(getRenderCampaign(losMochis('2026-09-10T12:00:00'))?.id).toBe('octubre-2026');
		expect(getRenderCampaign(losMochis('2027-03-10T12:00:00'))?.id).toBe('primavera-2027');
		expect(getRenderCampaign(losMochis('2027-07-01T12:00:00'))).toBeNull();
	});
});

describe('promo date preview', () => {
	it('reads ?fecha= as midnight of that day in Los Mochis', () => {
		expect(parsePromoPreviewDate('?fecha=2027-02-14')?.toISOString()).toBe(
			'2027-02-14T07:00:00.000Z',
		);
		expect(getActiveCampaign(parsePromoPreviewDate('?utm=x&fecha=2027-04-01')!)?.id).toBe(
			'primavera-2027',
		);
	});

	it('ignores missing, malformed and impossible dates', () => {
		for (const search of [
			'',
			'?fecha=',
			'?fecha=2027-2-14',
			'?fecha=14-02-2027',
			'?fecha=2027-02-30',
			'?fecha=2027-13-01',
			'?date=2027-02-14',
		]) {
			expect(parsePromoPreviewDate(search)).toBeNull();
		}
	});
});

describe('promo prices and codes', () => {
	it('charges the row price, or the regular price outside every row', () => {
		const nuevo = campaign('ano-nuevo-2027');
		expect(getPackagePrice('esencial', nuevo)).toBe(PRICE_TIERS.promo.esencial);
		expect(getStartingPrice(nuevo)).toBe(PRICE_TIERS.promo.esencial);
		expect(getStartingPrice(null)).toBe(getStartingRegularPrice());
		for (const pkg of PACKAGE_CATALOG) {
			expect(getPackagePrice(pkg.id, null)).toBe(pkg.regularPrice);
			expect(pkg.regularPrice).toBe(PRICE_TIERS.regular[pkg.id]);
		}
	});

	it('keeps the three fixed price tiers', () => {
		expect(PRICE_TIERS).toEqual({
			regular: { esencial: 1299, signature: 1799, atelier: 2499 },
			promo: { esencial: 999, signature: 1399, atelier: 1999 },
			fuerte: { esencial: 899, signature: 1299, atelier: 1899 },
		});
	});

	it('makes the season row the cheapest so prices rise after its countdown', () => {
		expect(campaign('temporada-2026').tier).toBe('fuerte');
		for (const row of PROMO_SCHEDULE.filter((candidate) => candidate.id !== 'temporada-2026')) {
			expect(row.tier).toBe('promo');
		}
	});

	it('encodes the promo price as the numeric suffix of each promo code', () => {
		for (const row of PROMO_SCHEDULE) {
			for (const pkg of PACKAGE_CATALOG) {
				const code = getPromoCode(pkg.id, row) ?? '';
				expect(code.startsWith(`${row.codePrefix}-`)).toBe(true);
				expect(Number(code.match(/(\d+)$/)?.[1])).toBe(PRICE_TIERS[row.tier][pkg.id]);
			}
		}
		expect(getPromoCode('esencial', null)).toBeNull();
	});

	it('uses the entry package for the general code and the section campaign codes', () => {
		const row = campaign('temporada-2026');
		expect(getGeneralPromoCode(row)).toBe(getPromoCode('esencial', row));
		expect(buildCampaignCode('HERO', getGeneralPromoCode(row))).toBe(
			`HERO-${getPromoCode('esencial', row)}`,
		);
		expect(buildCampaignCode('PRICING', null)).toBe('PRICING-REGULAR');
	});

	it('limits the express delivery extra to Esencial and Signature', () => {
		expect(getExpressDelivery().appliesTo).toEqual(['esencial', 'signature']);
	});
});

describe('promo copy', () => {
	it('formats peso amounts without depending on ICU data', () => {
		expect(formatMxnAmount(999)).toBe('999');
		expect(formatMxnAmount(12345)).toBe('12,345');
		expect(formatMxn(1250)).toBe('$1,250');
	});

	it('quotes a single reference during a row and none outside the calendar', () => {
		const row = campaign('ano-nuevo-2027');
		expect(buildGeneralMessage(row)).toBe(
			`Hola, quiero una invitación digital para mi evento. Ref. ${getGeneralPromoCode(row)}`,
		);
		expect(buildPackageMessage('signature', row)).toBe(
			`Hola, quiero el paquete Signature de ${formatMxn(PRICE_TIERS.promo.signature)} MXN. Ref. ${getPromoCode('signature', row)}`,
		);
		expect(buildGeneralMessage(null)).toBe(
			'Hola, quiero una invitación digital para mi evento.',
		);
		expect(buildPackageMessage('esencial', null)).toBe(
			`Hola, quiero el paquete Esencial de ${formatMxn(getStartingRegularPrice())} MXN.`,
		);
	});

	it('states the validity note with the last valid day', () => {
		const row = campaign('temporada-2026');
		expect(getValidityNote(row)).toBe(`${row.label}, válido hasta el ${row.endLabel}.`);
	});

	it('pluralizes the remaining-days label', () => {
		expect(formatDaysLeft(1)).toBe('Queda 1 día');
		expect(formatDaysLeft(5)).toBe('Quedan 5 días');
	});
});

describe('promo status', () => {
	it('is none outside the calendar', () => {
		expect(getPromoStatus(losMochis('2026-09-30T23:59:59'))).toEqual({
			phase: 'none',
			campaign: null,
			daysLeft: 0,
			showCountdown: false,
		});
		expect(getPromoStatus(losMochis('2027-03-01T00:00:01')).phase).toBe('none');
	});

	it('never counts down when the next row keeps or lowers the price', () => {
		// October → season lowers the price.
		const lastOctoberDay = getPromoStatus(losMochis('2026-10-31T23:00:00'));
		expect(lastOctoberDay).toMatchObject({
			phase: 'active',
			daysLeft: 1,
			showCountdown: false,
		});
	});

	it('counts down the end of the season before the new year price', () => {
		expect(getPromoStatus(losMochis('2026-12-05T23:00:00')).showCountdown).toBe(false);
		expect(getPromoStatus(losMochis('2026-12-06T12:00:00'))).toMatchObject({
			phase: 'active',
			daysLeft: 10,
			showCountdown: true,
		});
		const lastSeasonDay = getPromoStatus(losMochis('2026-12-15T23:00:00'));
		expect(lastSeasonDay).toMatchObject({ phase: 'active', daysLeft: 1, showCountdown: true });
	});

	it('does not count down a new year price that the month of love keeps', () => {
		expect(getPromoStatus(losMochis('2027-01-31T23:00:00'))).toMatchObject({
			phase: 'active',
			daysLeft: 1,
			showCountdown: false,
		});
	});

	it('counts down the last days before a regular month', () => {
		expect(getPromoStatus(losMochis('2027-02-21T23:00:00')).showCountdown).toBe(false);

		const firstCountdownDay = getPromoStatus(losMochis('2027-02-22T12:00:00'));
		expect(firstCountdownDay).toMatchObject({
			phase: 'active',
			daysLeft: 7,
			showCountdown: true,
		});

		const lastDay = getPromoStatus(losMochis('2027-02-28T23:00:00'));
		expect(lastDay).toMatchObject({ phase: 'active', daysLeft: 1, showCountdown: true });
		expect(formatDaysLeft(lastDay.daysLeft)).toBe('Queda 1 día');

		expect(getPromoStatus(losMochis('2027-04-30T12:00:00')).showCountdown).toBe(true);
		expect(getPromoStatus(losMochis('2027-06-30T12:00:00')).showCountdown).toBe(true);
	});
});

describe('promo calendar runway', () => {
	it('reports the days left until the last row ends', () => {
		const last = PROMO_SCHEDULE[PROMO_SCHEDULE.length - 1];
		expect(getScheduleRunway(losMochis('2027-06-16T12:00:00'))).toEqual({
			endsAt: last.endsAt,
			endLabel: last.endLabel,
			daysLeft: 15,
		});
		expect(getScheduleRunway(losMochis('2027-07-01T00:00:00'))?.daysLeft).toBe(0);
	});
});

describe('promo calendar runway check', () => {
	it('alerts 45 days before the calendar runs out', () => {
		expect(PROMO_RUNWAY_ALERT_DAYS).toBe(45);
	});

	it('passes with weeks left and alerts within the reminder window', async () => {
		const { checkPromoRunway } = await import('../../scripts/ops/promo-calendar-runway');
		expect(checkPromoRunway(losMochis('2027-05-01T12:00:00')).ok).toBe(true);

		const reminder = checkPromoRunway(losMochis('2027-05-20T12:00:00'));
		expect(reminder.ok).toBe(false);
		expect(reminder.detail).toContain('30 de junio de 2027');

		expect(checkPromoRunway(losMochis('2027-07-01T12:00:00'))).toEqual({
			ok: false,
			detail: 'No hay ninguna promoción programada: la portada muestra el precio regular.',
		});
	});
});
