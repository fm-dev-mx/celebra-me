import {
	calculateEstimatedLeadValue,
	clearEstimatedLeadValueCache,
	clearPersistedSnapshotStore,
	computeMonthlyEstimatedLeadValue,
	DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN,
	ESTIMATED_LEAD_VALUE_CURRENCY,
	fetchAllCommercialRows,
	formatMonthKey,
	getEstimatedLeadValue,
	getEstimatedLeadValueSync,
	resolveFallbackLeadValue,
	runMetaEstimatedLeadValueRecalculation,
	setEstimatedLeadValueCache,
} from '@/lib/commercial/meta-capi/estimated-lead-value';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
	SupabaseHttpError: class SupabaseHttpError extends Error {
		status: number;
		code: string;
		constructor(message: string, status = 500, code = 'error') {
			super(message);
			this.status = status;
			this.code = code;
		}
	},
}));

const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

describe('Estimated Lead Value service', () => {
	let infoSpy: jest.SpyInstance;
	let warnSpy: jest.SpyInstance;
	let errorSpy: jest.SpyInstance;

	beforeEach(() => {
		mockRestRequest.mockReset();
		clearEstimatedLeadValueCache();
		clearPersistedSnapshotStore();
		infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
		warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		infoSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	describe('formatMonthKey', () => {
		it('formats Date into YYYY-MM UTC string', () => {
			expect(formatMonthKey(new Date('2026-10-26T12:00:00.000Z'))).toBe('2026-10');
			expect(formatMonthKey(new Date('2026-01-05T00:00:00.000Z'))).toBe('2026-01');
		});
	});

	describe('resolveFallbackLeadValue', () => {
		it('returns default fallback 150 MXN when no override is set', () => {
			expect(resolveFallbackLeadValue()).toBe(DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN);
		});

		it('returns explicit override when given a positive number', () => {
			expect(resolveFallbackLeadValue(200)).toBe(200);
		});
	});

	describe('calculateEstimatedLeadValue', () => {
		const fixedDate = new Date('2026-10-15T12:00:00.000Z');

		it('returns fallback constant when totalLeads is zero or negative', () => {
			const result = calculateEstimatedLeadValue({
				totalLeads: 0,
				totalSales: 10,
				totalRevenue: 15000,
				now: fixedDate,
			});
			expect(result.estimatedValue).toBe(DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN);
			expect(result.currency).toBe(ESTIMATED_LEAD_VALUE_CURRENCY);
			expect(result.isFallback).toBe(true);
			expect(result.leadToSaleRate).toBe(0);
			expect(result.averageTicket).toBe(0);
			expect(result.month).toBe('2026-10');
		});

		it('returns fallback constant when totalSales is zero', () => {
			const result = calculateEstimatedLeadValue({
				totalLeads: 100,
				totalSales: 0,
				totalRevenue: 0,
				now: fixedDate,
			});
			expect(result.estimatedValue).toBe(DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN);
			expect(result.isFallback).toBe(true);
		});

		it('returns fallback constant when totalRevenue is zero or negative', () => {
			const result = calculateEstimatedLeadValue({
				totalLeads: 100,
				totalSales: 10,
				totalRevenue: 0,
				now: fixedDate,
			});
			expect(result.estimatedValue).toBe(DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN);
			expect(result.isFallback).toBe(true);
		});

		it('calculates (sales / leads) * (revenue / sales) accurately', () => {
			// 100 leads, 10 sales, 15,000 MXN revenue -> rate = 0.1, ticket = 1,500, value = 150 MXN
			const result = calculateEstimatedLeadValue({
				totalLeads: 100,
				totalSales: 10,
				totalRevenue: 15000,
				now: fixedDate,
			});
			expect(result.estimatedValue).toBe(150);
			expect(result.leadToSaleRate).toBe(0.1);
			expect(result.averageTicket).toBe(1500);
			expect(result.isFallback).toBe(false);
			expect(result.currency).toBe('MXN');
			expect(result.month).toBe('2026-10');
		});

		it('handles fractional rate and ticket values with 2 decimal rounding', () => {
			// 73 leads, 5 sales, 6,495 MXN revenue -> value = 6495 / 73 ≈ 88.97
			const result = calculateEstimatedLeadValue({
				totalLeads: 73,
				totalSales: 5,
				totalRevenue: 6495,
				now: fixedDate,
			});
			expect(result.estimatedValue).toBe(88.97);
			expect(result.leadToSaleRate).toBe(0.0685);
			expect(result.averageTicket).toBe(1299);
			expect(result.isFallback).toBe(false);
		});

		it('respects a custom fallback value parameter', () => {
			const result = calculateEstimatedLeadValue({
				totalLeads: 0,
				totalSales: 0,
				totalRevenue: 0,
				fallbackValue: 99.5,
				now: fixedDate,
			});
			expect(result.estimatedValue).toBe(99.5);
			expect(result.isFallback).toBe(true);
		});
	});

	describe('computeMonthlyEstimatedLeadValue', () => {
		const fixedDate = new Date('2026-10-01T08:00:00.000Z');

		it('queries leads and orders from Supabase and calculates monthly value', async () => {
			mockRestRequest
				.mockResolvedValueOnce([
					{ id: 'lead-1', status: 'new' },
					{ id: 'lead-2', status: 'contacted' },
					{ id: 'lead-3', status: 'quoted' },
					{ id: 'lead-4', status: 'spam' }, // Should be excluded
				])
				.mockResolvedValueOnce([
					{
						id: 'order-1',
						status: 'deposit_paid',
						amount_paid: 1000,
						total_amount: 1799,
					},
					{ id: 'order-2', status: 'paid', amount_paid: 1299, total_amount: 1299 },
					{ id: 'order-3', status: 'pending', amount_paid: 0, total_amount: 1799 }, // Unpaid, excluded from sales
				]);

			const result = await computeMonthlyEstimatedLeadValue({ now: fixedDate });

			expect(mockRestRequest).toHaveBeenCalledTimes(2);
			expect(result.totalLeads).toBe(3); // 4 minus 1 spam
			expect(result.totalSales).toBe(2);
			expect(result.totalRevenue).toBe(2299);
			// 2299 / 3 ≈ 766.33
			expect(result.estimatedValue).toBe(766.33);
			expect(result.isFallback).toBe(false);
			expect(result.month).toBe('2026-10');
		});

		it('safely catches Supabase errors and returns fallback without throwing', async () => {
			mockRestRequest.mockRejectedValueOnce(new Error('Network error'));

			const result = await computeMonthlyEstimatedLeadValue({ now: fixedDate });

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('[meta-lead-value] Failed to compute from database'),
				expect.objectContaining({ code: expect.any(String) }),
			);
			expect(result.estimatedValue).toBe(DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN);
			expect(result.isFallback).toBe(true);
		});
	});

	describe('pagination (> 1000 rows)', () => {
		it('paginates and aggregates populations exceeding the 1000-row API cap', async () => {
			const fixedDate = new Date('2026-10-26T12:00:00.000Z');
			// Generate 1500 leads: 1000 on page 1, 500 on page 2
			const leadsPage1 = Array.from({ length: 1000 }, (_, i) => ({
				id: `lead-${i}`,
				status: 'new',
			}));
			const leadsPage2 = Array.from({ length: 500 }, (_, i) => ({
				id: `lead-${1000 + i}`,
				status: 'new',
			}));
			// Generate 1200 orders: 1000 on page 1 (50 MXN each), 200 on page 2 (50 MXN each) -> total 60,000 MXN
			const ordersPage1 = Array.from({ length: 1000 }, (_, i) => ({
				id: `order-${i}`,
				status: 'paid',
				amount_paid: 50,
				total_amount: 50,
			}));
			const ordersPage2 = Array.from({ length: 200 }, (_, i) => ({
				id: `order-${1000 + i}`,
				status: 'paid',
				amount_paid: 50,
				total_amount: 50,
			}));

			mockRestRequest
				.mockResolvedValueOnce(leadsPage1)
				.mockResolvedValueOnce(leadsPage2)
				.mockResolvedValueOnce(ordersPage1)
				.mockResolvedValueOnce(ordersPage2);

			const result = await computeMonthlyEstimatedLeadValue({ now: fixedDate });

			expect(mockRestRequest).toHaveBeenCalledTimes(4);
			expect(result.totalLeads).toBe(1500);
			expect(result.totalSales).toBe(1200);
			expect(result.totalRevenue).toBe(60000);
			// 60,000 / 1500 = 40 MXN
			expect(result.estimatedValue).toBe(40);
			expect(result.isFallback).toBe(false);
		});

		it('fetchAllCommercialRows returns empty array when table is empty', async () => {
			mockRestRequest.mockResolvedValueOnce([]);
			const rows = await fetchAllCommercialRows<{ id: string }>('empty_table');
			expect(rows).toEqual([]);
		});
	});

	describe('getEstimatedLeadValue and getEstimatedLeadValueSync', () => {
		const fixedDate = new Date('2026-10-15T12:00:00.000Z');

		it('returns cached value if present for current month', async () => {
			setEstimatedLeadValueCache({
				totalLeads: 50,
				totalSales: 5,
				totalRevenue: 7500,
				leadToSaleRate: 0.1,
				averageTicket: 1500,
				estimatedValue: 150,
				currency: 'MXN',
				isFallback: false,
				computedAt: fixedDate.toISOString(),
				month: '2026-10',
			});

			const value = await getEstimatedLeadValue(fixedDate);
			expect(value).toBe(150);
			expect(mockRestRequest).not.toHaveBeenCalled();

			const syncValue = getEstimatedLeadValueSync(fixedDate);
			expect(syncValue).toBe(150);
		});

		it('recomputes when cache is from a different month', async () => {
			setEstimatedLeadValueCache({
				totalLeads: 50,
				totalSales: 5,
				totalRevenue: 7500,
				leadToSaleRate: 0.1,
				averageTicket: 1500,
				estimatedValue: 120,
				currency: 'MXN',
				isFallback: false,
				computedAt: '2026-09-01T00:00:00.000Z',
				month: '2026-09',
			});

			mockRestRequest
				.mockResolvedValueOnce([{ id: 'lead-1', status: 'new' }])
				.mockResolvedValueOnce([
					{
						id: 'order-1',
						status: 'deposit_paid',
						amount_paid: 1500,
						total_amount: 1500,
					},
				]);

			const value = await getEstimatedLeadValue(fixedDate); // 2026-10
			expect(value).toBe(1500); // 1500 / 1
			expect(mockRestRequest).toHaveBeenCalledTimes(2);
		});

		it('getEstimatedLeadValueSync returns default fallback when cache is empty', () => {
			clearEstimatedLeadValueCache();
			expect(getEstimatedLeadValueSync(fixedDate)).toBe(
				DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN,
			);
		});
	});

	describe('Worker instance recycling and shared snapshot persistence', () => {
		const fixedDate = new Date('2026-10-26T12:00:00.000Z');

		it('persists monthly snapshot and resolves it after Worker isolate recycling', async () => {
			mockRestRequest
				.mockResolvedValueOnce([{ id: 'lead-1', status: 'new' }])
				.mockResolvedValueOnce([
					{ id: 'order-1', status: 'paid', amount_paid: 300, total_amount: 300 },
				]);

			const status = await runMetaEstimatedLeadValueRecalculation(fixedDate);
			expect(status).toBe('completed');
			expect(await getEstimatedLeadValue(fixedDate)).toBe(300);

			// Simulate recycling the Worker instance: module memory cache is reset
			clearEstimatedLeadValueCache();

			// Subsequent database calls return different values (e.g. sales made later in the month)
			mockRestRequest
				.mockResolvedValueOnce([{ id: 'lead-1', status: 'new' }])
				.mockResolvedValueOnce([
					{ id: 'order-1', status: 'paid', amount_paid: 600, total_amount: 600 },
				]);

			// Cold instance must resolve the published monthly snapshot (300), preserving Pixel/CAPI parity
			const valueOnRecycledInstance = await getEstimatedLeadValue(fixedDate);
			expect(valueOnRecycledInstance).toBe(300);

			// Synchronous getter also reads the persisted snapshot
			expect(getEstimatedLeadValueSync(fixedDate)).toBe(300);
		});
	});

	describe('transient failures and database recovery', () => {
		const fixedDate = new Date('2026-10-26T12:00:00.000Z');

		it('temporary read outage does not freeze fallback once database recovers', async () => {
			// First read fails due to temporary network outage
			mockRestRequest.mockRejectedValueOnce(new Error('temporary database outage'));

			const fallbackValue = await getEstimatedLeadValue(fixedDate);
			expect(fallbackValue).toBe(DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN);

			// Database recovers on next call
			mockRestRequest
				.mockResolvedValueOnce([{ id: 'lead-1', status: 'new' }])
				.mockResolvedValueOnce([
					{ id: 'order-1', status: 'paid', amount_paid: 300, total_amount: 300 },
				]);

			const recoveredValue = await getEstimatedLeadValue(fixedDate);
			expect(recoveredValue).toBe(300);
		});

		it('scheduled recalculation reports failed and does not freeze fallback on database error', async () => {
			mockRestRequest.mockRejectedValueOnce(new Error('transient scheduled error'));

			const status = await runMetaEstimatedLeadValueRecalculation(fixedDate);
			expect(status).toBe('failed');
			expect(errorSpy).toHaveBeenCalledWith(
				'[meta-lead-value][recalculation] failed',
				expect.objectContaining({ error: expect.any(Object) }),
			);

			// Snapshot was not frozen with fallback; healthy database call succeeds
			mockRestRequest
				.mockResolvedValueOnce([{ id: 'lead-1', status: 'new' }])
				.mockResolvedValueOnce([
					{ id: 'order-1', status: 'paid', amount_paid: 300, total_amount: 300 },
				]);

			const retryStatus = await runMetaEstimatedLeadValueRecalculation(fixedDate);
			expect(retryStatus).toBe('completed');
			expect(await getEstimatedLeadValue(fixedDate)).toBe(300);
		});
	});

	describe('runMetaEstimatedLeadValueRecalculation', () => {
		it('executes recalculation and logs completed outcome', async () => {
			mockRestRequest
				.mockResolvedValueOnce([{ id: 'lead-1', status: 'new' }])
				.mockResolvedValueOnce([
					{ id: 'order-1', status: 'paid', amount_paid: 1000, total_amount: 1000 },
				]);

			const status = await runMetaEstimatedLeadValueRecalculation();
			expect(status).toBe('completed');
			expect(infoSpy).toHaveBeenCalledWith(
				'[meta-lead-value][recalculation] completed',
				expect.objectContaining({
					estimatedValue: 1000,
					currency: 'MXN',
					totalLeads: 1,
					totalSales: 1,
				}),
			);
		});
	});
});
