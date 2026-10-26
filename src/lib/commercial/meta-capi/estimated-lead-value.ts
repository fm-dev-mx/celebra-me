/**
 * Estimated Lead Value calculator and monthly recalculation service for Meta CAPI and Pixel.
 *
 * Contact and Lead carry:
 *   value = lead→sale rate × average ticket
 *   currency = 'MXN'
 *
 * Formula:
 *   leadToSaleRate = totalSales / totalLeads
 *   averageTicket = totalRevenue / totalSales
 *   estimatedValue = leadToSaleRate * averageTicket = totalRevenue / totalLeads
 *
 * A scheduled job recalculates this figure each month from recorded leads and orders.
 * The calculated value is persisted in a single shared source of truth (a row in Supabase
 * table `meta_ads_insights_daily`) so all Worker isolates and colos read the exact same snapshot.
 * In-memory state serves only as a per-isolate accelerator; cold/recycled isolates resolve
 * the persisted row from Supabase.
 * Ad-hoc calculations also persist this snapshot (including legitimate 0-sales fallbacks),
 * preventing repetitive table scans on every request.
 * Only transient database errors skip persisting and caching so subsequent runs can retry.
 *
 * Spec: .agent/tmp/reports/2026-10-25-client-loop-proposal.md (Section 8).
 */
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { safeErr } from '@/lib/server/safe-error';

export const DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN = 150;
export const ESTIMATED_LEAD_VALUE_CURRENCY = 'MXN';
export const DEFAULT_PAGE_SIZE = 1000;

export const ESTIMATED_LEAD_VALUE_SNAPSHOT_ACCOUNT = 'meta_commercial';
export const ESTIMATED_LEAD_VALUE_SNAPSHOT_LEVEL = 'campaign';
export const ESTIMATED_LEAD_VALUE_SNAPSHOT_OBJECT_ID = 'estimated_lead_value';
export const ESTIMATED_LEAD_VALUE_SNAPSHOT_WINDOW = 'monthly_estimate';

export interface EstimatedLeadValueCalculation {
	totalLeads: number;
	totalSales: number;
	totalRevenue: number;
	leadToSaleRate: number;
	averageTicket: number;
	estimatedValue: number;
	currency: 'MXN';
	isFallback: boolean;
	computedAt: string;
	month: string;
	error?: unknown;
}

export interface CalculateEstimatedLeadValueInput {
	totalLeads: number;
	totalSales: number;
	totalRevenue: number;
	fallbackValue?: number;
	now?: Date;
}

export function resolveFallbackLeadValue(override?: number): number {
	if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
		return override;
	}
	return DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN;
}

export function formatMonthKey(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	return `${year}-${month}`;
}

/**
 * Pure calculation of estimated lead value: (sales / leads) * (revenue / sales).
 * Falls back to constant when totalLeads, totalSales, or totalRevenue <= 0.
 */
export function calculateEstimatedLeadValue(
	input: CalculateEstimatedLeadValueInput,
): EstimatedLeadValueCalculation {
	const fallback = resolveFallbackLeadValue(input.fallbackValue);
	const now = input.now ?? new Date();
	const month = formatMonthKey(now);
	const computedAt = now.toISOString();

	const { totalLeads, totalSales, totalRevenue } = input;

	if (totalLeads <= 0 || totalSales <= 0 || totalRevenue <= 0) {
		return {
			totalLeads: Math.max(0, totalLeads),
			totalSales: Math.max(0, totalSales),
			totalRevenue: Math.max(0, totalRevenue),
			leadToSaleRate: 0,
			averageTicket: 0,
			estimatedValue: fallback,
			currency: ESTIMATED_LEAD_VALUE_CURRENCY,
			isFallback: true,
			computedAt,
			month,
		};
	}

	const leadToSaleRate = totalSales / totalLeads;
	const averageTicket = totalRevenue / totalSales;
	const rawValue = leadToSaleRate * averageTicket; // = totalRevenue / totalLeads
	const roundedValue = Math.round(rawValue * 100) / 100;

	if (!Number.isFinite(roundedValue) || roundedValue <= 0) {
		return {
			totalLeads,
			totalSales,
			totalRevenue,
			leadToSaleRate: Math.round(leadToSaleRate * 10000) / 10000,
			averageTicket: Math.round(averageTicket * 100) / 100,
			estimatedValue: fallback,
			currency: ESTIMATED_LEAD_VALUE_CURRENCY,
			isFallback: true,
			computedAt,
			month,
		};
	}

	return {
		totalLeads,
		totalSales,
		totalRevenue,
		leadToSaleRate: Math.round(leadToSaleRate * 10000) / 10000,
		averageTicket: Math.round(averageTicket * 100) / 100,
		estimatedValue: roundedValue,
		currency: ESTIMATED_LEAD_VALUE_CURRENCY,
		isFallback: false,
		computedAt,
		month,
	};
}

let memoryCache: EstimatedLeadValueCalculation | null = null;

/**
 * Resets the in-memory cache accelerator (simulates a recycled Worker isolate).
 */
export function clearEstimatedLeadValueCache(): void {
	memoryCache = null;
}

/**
 * Compatibility helper.
 */
export function clearPersistedSnapshotStore(): void {
	// Snapshots are stored in Supabase; memory accelerator is cleared.
	memoryCache = null;
}

/**
 * Resets in-memory cache accelerator.
 */
export function resetEstimatedLeadValueStorageForTesting(): void {
	memoryCache = null;
}

/**
 * Manually sets the memory cache accelerator.
 */
export function setEstimatedLeadValueCache(calc: EstimatedLeadValueCalculation): void {
	memoryCache = calc;
}

/**
 * Reads the persisted monthly snapshot from Supabase table `meta_ads_insights_daily`.
 */
export async function readPersistedSnapshot(
	month: string,
): Promise<EstimatedLeadValueCalculation | null> {
	try {
		const insightDate = `${month}-01`;
		const pathWithQuery = `meta_ads_insights_daily?account_id=eq.${ESTIMATED_LEAD_VALUE_SNAPSHOT_ACCOUNT}&level=eq.${ESTIMATED_LEAD_VALUE_SNAPSHOT_LEVEL}&object_id=eq.${ESTIMATED_LEAD_VALUE_SNAPSHOT_OBJECT_ID}&insight_date=eq.${insightDate}&attribution_window=eq.${ESTIMATED_LEAD_VALUE_SNAPSHOT_WINDOW}&select=raw&limit=1`;
		const rows = await supabaseRestRequest<Array<{ raw: EstimatedLeadValueCalculation }>>({
			pathWithQuery,
			method: 'GET',
			useServiceRole: true,
		});
		if (Array.isArray(rows) && rows.length > 0 && rows[0]?.raw) {
			const snapshot = rows[0].raw;
			if (snapshot.month === month && typeof snapshot.estimatedValue === 'number') {
				return snapshot;
			}
		}
	} catch (error) {
		console.warn('[meta-lead-value] Failed to read snapshot from database:', safeErr(error));
	}
	return null;
}

/**
 * Synchronous snapshot lookup from memory cache accelerator.
 */
export function getPersistedSnapshotSync(month: string): EstimatedLeadValueCalculation | null {
	if (memoryCache && memoryCache.month === month && !memoryCache.error) {
		return memoryCache;
	}
	return null;
}

/**
 * Persists the monthly snapshot to Supabase table `meta_ads_insights_daily`.
 * Never persists transient errors.
 */
export async function writePersistedSnapshot(
	calculation: EstimatedLeadValueCalculation,
): Promise<void> {
	if (calculation.error) return;
	try {
		const insightDate = `${calculation.month}-01`;
		const rawPayload = {
			totalLeads: calculation.totalLeads,
			totalSales: calculation.totalSales,
			totalRevenue: calculation.totalRevenue,
			leadToSaleRate: calculation.leadToSaleRate,
			averageTicket: calculation.averageTicket,
			estimatedValue: calculation.estimatedValue,
			currency: calculation.currency,
			isFallback: calculation.isFallback,
			computedAt: calculation.computedAt,
			month: calculation.month,
		};
		const row = {
			account_id: ESTIMATED_LEAD_VALUE_SNAPSHOT_ACCOUNT,
			level: ESTIMATED_LEAD_VALUE_SNAPSHOT_LEVEL,
			object_id: ESTIMATED_LEAD_VALUE_SNAPSHOT_OBJECT_ID,
			insight_date: insightDate,
			attribution_window: ESTIMATED_LEAD_VALUE_SNAPSHOT_WINDOW,
			raw: rawPayload,
			collected_at: new Date().toISOString(),
		};
		await supabaseRestRequest<unknown>({
			pathWithQuery:
				'meta_ads_insights_daily?on_conflict=account_id,level,object_id,insight_date,attribution_window',
			method: 'POST',
			useServiceRole: true,
			prefer: 'resolution=merge-duplicates,return=minimal',
			body: [row],
		});
	} catch (error) {
		console.warn('[meta-lead-value] Failed to write snapshot to database:', safeErr(error));
	}
}

interface StoredLeadRow {
	id: string;
	status?: string | null;
}

interface StoredOrderRow {
	id: string;
	status: string;
	amount_paid?: number | string | null;
	total_amount?: number | string | null;
}

/**
 * Deterministically paginates complete table rows from Supabase with stable ordering `order=id.asc`.
 */
export async function fetchAllCommercialRows<T extends { id: string }>(
	pathWithQuery: string,
	pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
	const allRows: T[] = [];
	let offset = 0;

	for (let page = 0; page < 1000; page++) {
		const separator = pathWithQuery.includes('?') ? '&' : '?';
		const batch = await supabaseRestRequest<T[]>({
			pathWithQuery: `${pathWithQuery}${separator}order=id.asc&limit=${pageSize}&offset=${offset}`,
			method: 'GET',
			useServiceRole: true,
		});

		if (!Array.isArray(batch) || batch.length === 0) {
			break;
		}

		allRows.push(...batch);

		if (batch.length < pageSize) {
			break;
		}

		offset += batch.length;
	}

	return allRows;
}

/**
 * Computes the monthly estimated lead value from Supabase leads and sales orders.
 * Legitimate 0-sales fallbacks are cached in memory; only transient errors skip caching.
 */
export async function computeMonthlyEstimatedLeadValue(options?: {
	now?: Date;
	fallbackValue?: number;
}): Promise<EstimatedLeadValueCalculation> {
	const now = options?.now ?? new Date();
	const fallback = resolveFallbackLeadValue(options?.fallbackValue);

	try {
		const leads = await fetchAllCommercialRows<StoredLeadRow>('leads?select=id,status');
		const orders = await fetchAllCommercialRows<StoredOrderRow>(
			'sales_orders?select=id,status,amount_paid,total_amount',
		);

		const safeLeads = Array.isArray(leads) ? leads : [];
		const safeOrders = Array.isArray(orders) ? orders : [];

		const nonSpamLeads = safeLeads.filter((l) => l.status !== 'spam');
		const totalLeads = nonSpamLeads.length;

		let totalSales = 0;
		let totalRevenue = 0;

		for (const order of safeOrders) {
			const paid = Number(order.amount_paid) || 0;
			const isPaidOrder =
				order.status === 'deposit_paid' || order.status === 'paid' || paid > 0;
			if (isPaidOrder) {
				totalSales++;
				totalRevenue += paid > 0 ? paid : Number(order.total_amount) || 0;
			}
		}

		const calculation = calculateEstimatedLeadValue({
			totalLeads,
			totalSales,
			totalRevenue,
			fallbackValue: fallback,
			now,
		});

		// Cache legitimate calculation in memory (even if isFallback: true because 0 sales)
		memoryCache = calculation;

		return calculation;
	} catch (error) {
		console.warn(
			'[meta-lead-value] Failed to compute from database, using fallback:',
			safeErr(error),
		);
		const fallbackCalc = calculateEstimatedLeadValue({
			totalLeads: 0,
			totalSales: 0,
			totalRevenue: 0,
			fallbackValue: fallback,
			now,
		});

		// Attach error and DO NOT save fallback into memoryCache
		return {
			...fallbackCalc,
			error,
		};
	}
}

/**
 * Resolves the current estimated lead value:
 * 1. Fast in-memory cache accelerator (per-isolate).
 * 2. Shared monthly persisted snapshot from Supabase (all isolates/colos).
 * 3. On-demand database calculation if no snapshot exists yet, persisting the result.
 * Never freezes fallback on transient errors.
 */
export async function getEstimatedLeadValue(now = new Date()): Promise<number> {
	const currentMonth = formatMonthKey(now);

	// 1. Memory cache accelerator
	if (memoryCache && memoryCache.month === currentMonth && !memoryCache.error) {
		return memoryCache.estimatedValue;
	}

	// 2. Persisted monthly snapshot from Supabase
	const snapshot = await readPersistedSnapshot(currentMonth);
	if (snapshot && snapshot.month === currentMonth && !snapshot.error) {
		memoryCache = snapshot;
		return snapshot.estimatedValue;
	}

	// 3. Ad-hoc computation if no snapshot exists yet in Supabase
	const calculation = await computeMonthlyEstimatedLeadValue({ now });
	if (!calculation.error) {
		memoryCache = calculation;
		// Persist the ad-hoc result (even if legitimate fallback) so other isolates and future calls don't rescan!
		await writePersistedSnapshot(calculation);
	}
	return calculation.estimatedValue;
}

/**
 * Synchronous getter returning the cached value or the fallback constant.
 */
export function getEstimatedLeadValueSync(now = new Date()): number {
	const currentMonth = formatMonthKey(now);
	if (memoryCache && memoryCache.month === currentMonth && !memoryCache.error) {
		return memoryCache.estimatedValue;
	}
	return resolveFallbackLeadValue();
}

/**
 * Scheduled job runner that executes the monthly recalculation.
 * Reports failure if database query encounters an error, allowing subsequent daily retries.
 */
export async function runMetaEstimatedLeadValueRecalculation(
	now = new Date(),
): Promise<'completed' | 'failed'> {
	try {
		const calculation = await computeMonthlyEstimatedLeadValue({ now });

		if (calculation.error) {
			console.error('[meta-lead-value][recalculation] failed', {
				status:
					calculation.error instanceof SupabaseHttpError
						? calculation.error.status
						: null,
				code:
					calculation.error instanceof SupabaseHttpError ? calculation.error.code : null,
				error: safeErr(calculation.error),
			});
			return 'failed';
		}

		// Persist valid calculation (including legitimate 0-sales fallback)
		await writePersistedSnapshot(calculation);
		memoryCache = calculation;

		console.info('[meta-lead-value][recalculation] completed', {
			estimatedValue: calculation.estimatedValue,
			currency: calculation.currency,
			leadToSaleRate: calculation.leadToSaleRate,
			averageTicket: calculation.averageTicket,
			totalLeads: calculation.totalLeads,
			totalSales: calculation.totalSales,
			totalRevenue: calculation.totalRevenue,
			isFallback: calculation.isFallback,
			month: calculation.month,
		});
		return 'completed';
	} catch (error) {
		console.error('[meta-lead-value][recalculation] failed', {
			status: error instanceof SupabaseHttpError ? error.status : null,
			code: error instanceof SupabaseHttpError ? error.code : null,
			error: safeErr(error),
		});
		return 'failed';
	}
}
