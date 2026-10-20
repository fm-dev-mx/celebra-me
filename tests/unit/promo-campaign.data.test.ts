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
	getStartingPrice,
	getStartingRegularPrice,
	getValidityNote,
	PACKAGE_CATALOG,
	PROMO_SCHEDULE,
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

	it('reports overlapping rows and promo prices at or above the regular price', () => {
		const [first] = PROMO_SCHEDULE;
		const problems = validatePromoSchedule([
			first,
			{ ...first, id: 'clash', prices: { ...first.prices, atelier: 2499 } },
		]);
		expect(problems).toEqual(
			expect.arrayContaining([
				expect.stringContaining('clash: overlaps'),
				expect.stringContaining('clash: duplicate codePrefix'),
				expect.stringContaining('clash: atelier'),
			]),
		);
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
		expect(getActiveCampaign(losMochis('2027-02-01T00:00:00'))).toBeNull();
	});

	it('builds with the active row, else the next one, else none', () => {
		expect(getRenderCampaign(losMochis('2026-11-20T12:00:00'))?.id).toBe('temporada-2026');
		expect(getRenderCampaign(losMochis('2026-09-10T12:00:00'))?.id).toBe('octubre-2026');
		expect(getRenderCampaign(losMochis('2027-03-01T12:00:00'))).toBeNull();
	});
});

describe('promo prices and codes', () => {
	it('charges the row price, or the regular price outside every row', () => {
		const nuevo = campaign('ano-nuevo-2027');
		expect(getPackagePrice('esencial', nuevo)).toBe(nuevo.prices.esencial);
		expect(getStartingPrice(nuevo)).toBe(nuevo.prices.esencial);
		expect(getStartingPrice(null)).toBe(getStartingRegularPrice());
		for (const pkg of PACKAGE_CATALOG) {
			expect(getPackagePrice(pkg.id, null)).toBe(pkg.regularPrice);
		}
	});

	it('encodes the promo price as the numeric suffix of each promo code', () => {
		for (const row of PROMO_SCHEDULE) {
			for (const pkg of PACKAGE_CATALOG) {
				const code = getPromoCode(pkg.id, row) ?? '';
				expect(code.startsWith(`${row.codePrefix}-`)).toBe(true);
				expect(Number(code.match(/(\d+)$/)?.[1])).toBe(row.prices[pkg.id]);
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
			`Hola, quiero el paquete Signature de ${formatMxn(row.prices.signature)} MXN. Ref. ${getPromoCode('signature', row)}`,
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
		expect(getPromoStatus(losMochis('2027-02-01T00:00:01')).phase).toBe('none');
	});

	it('never counts down when the next row keeps or lowers the price', () => {
		// October → season keeps the price; season → new year lowers it.
		const lastOctoberDay = getPromoStatus(losMochis('2026-10-31T23:00:00'));
		expect(lastOctoberDay).toMatchObject({
			phase: 'active',
			daysLeft: 1,
			showCountdown: false,
		});
		const lastSeasonDay = getPromoStatus(losMochis('2026-12-15T23:00:00'));
		expect(lastSeasonDay).toMatchObject({ phase: 'active', daysLeft: 1, showCountdown: false });
	});

	it('counts down the last ten days before the price goes up', () => {
		expect(getPromoStatus(losMochis('2027-01-21T23:00:00')).showCountdown).toBe(false);

		const firstCountdownDay = getPromoStatus(losMochis('2027-01-22T12:00:00'));
		expect(firstCountdownDay).toMatchObject({
			phase: 'active',
			daysLeft: 10,
			showCountdown: true,
		});

		const lastDay = getPromoStatus(losMochis('2027-01-31T23:00:00'));
		expect(lastDay).toMatchObject({ phase: 'active', daysLeft: 1, showCountdown: true });
		expect(formatDaysLeft(lastDay.daysLeft)).toBe('Queda 1 día');
	});
});

describe('promo calendar runway', () => {
	it('reports the days left until the last row ends', () => {
		const last = PROMO_SCHEDULE[PROMO_SCHEDULE.length - 1];
		expect(getScheduleRunway(losMochis('2027-01-17T12:00:00'))).toEqual({
			endsAt: last.endsAt,
			endLabel: last.endLabel,
			daysLeft: 15,
		});
		expect(getScheduleRunway(losMochis('2027-03-01T00:00:00'))?.daysLeft).toBe(0);
	});
});

describe('promo calendar runway check', () => {
	it('passes with weeks left and alerts within the reminder window', async () => {
		const { checkPromoRunway } = await import('../../scripts/ops/promo-calendar-runway');
		expect(checkPromoRunway(losMochis('2026-12-01T12:00:00')).ok).toBe(true);

		const reminder = checkPromoRunway(losMochis('2027-01-20T12:00:00'));
		expect(reminder.ok).toBe(false);
		expect(reminder.detail).toContain('31 de enero de 2027');

		expect(checkPromoRunway(losMochis('2027-03-01T12:00:00'))).toEqual({
			ok: false,
			detail: 'No hay ninguna promoción programada: la portada muestra el precio regular.',
		});
	});
});
