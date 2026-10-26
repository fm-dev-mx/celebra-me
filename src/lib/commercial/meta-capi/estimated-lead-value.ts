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
 * The calculated value is persisted in a shared monthly snapshot across Worker isolates.
 * In-memory state serves as a fast accelerator; when unpopulated (e.g. after instance recycling),
 * isolates read the shared monthly snapshot.
 * If recalculation fails due to transient database errors, fallback is NOT cached as the monthly
 * snapshot and the job reports failure so subsequent runs can retry.
 *
 * Spec: .agent/tmp/reports/2026-10-25-client-loop-proposal.md (Section 8).
 */
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { safeErr } from '@/lib/server/safe-error';

export const DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN = 150;
export const ESTIMATED_LEAD_VALUE_CURRENCY = 'MXN';
export const DEFAULT_PAGE_SIZE = 1000;

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
const persistedSnapshotStore = new Map<string, EstimatedLeadValueCalculation>();

/**
 * Resets the in-memory cache accelerator (simulates a recycled Worker isolate).
 */
export function clearEstimatedLeadValueCache(options?: { clearPersisted?: boolean }): void {
	memoryCache = null;
	if (options?.clearPersisted) {
		persistedSnapshotStore.clear();
	}
}

export function clearPersistedSnapshotStore(): void {
	persistedSnapshotStore.clear();
}

/**
 * Resets both in-memory cache and persisted snapshot storage (for clean test setups).
 */
export function resetEstimatedLeadValueStorageForTesting(): void {
	memoryCache = null;
	persistedSnapshotStore.clear();
}

/**
 * Manually sets the memory cache and, if valid, the shared persisted snapshot.
 */
export function setEstimatedLeadValueCache(calc: EstimatedLeadValueCalculation): void {
	memoryCache = calc;
}

function getWorkerDefaultCache(): Cache | null {
	if (typeof caches === 'undefined') return null;
	const storage = caches as unknown as { default?: Cache };
	return storage.default ?? null;
}

/**
 * Reads the persisted monthly snapshot from shared storage / Cloudflare Cache API.
 */
export async function readPersistedSnapshot(
	month: string,
): Promise<EstimatedLeadValueCalculation | null> {
	const cache = getWorkerDefaultCache();
	if (cache) {
		try {
			const req = new Request(`https://celebra-me.internal/cache/meta-lead-value/${month}`);
			const match = await cache.match(req);
			if (match) {
				const json = (await match.json()) as EstimatedLeadValueCalculation;
				if (json && json.month === month && !json.isFallback) {
					persistedSnapshotStore.set(month, json);
					return json;
				}
			}
		} catch {
			// Ignore cache read failures and fall back to local store
		}
	}
	return persistedSnapshotStore.get(month) ?? null;
}

/**
 * Synchronous snapshot lookup from local persisted store.
 */
export function getPersistedSnapshotSync(month: string): EstimatedLeadValueCalculation | null {
	return persistedSnapshotStore.get(month) ?? null;
}

/**
 * Persists the monthly snapshot to shared storage and Cloudflare Cache API.
 */
export async function writePersistedSnapshot(
	calculation: EstimatedLeadValueCalculation,
): Promise<void> {
	if (calculation.isFallback) return;
	persistedSnapshotStore.set(calculation.month, calculation);

	const cache = getWorkerDefaultCache();
	if (cache) {
		try {
			const req = new Request(
				`https://celebra-me.internal/cache/meta-lead-value/${calculation.month}`,
			);
			const res = new Response(JSON.stringify(calculation), {
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'public, max-age=2592000',
				},
			});
			await cache.put(req, res);
		} catch {
			// Ignore cache put failures
		}
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
 * Deterministically paginates complete table rows from Supabase, preventing truncation at 1000 rows.
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
			pathWithQuery: `${pathWithQuery}${separator}limit=${pageSize}&offset=${offset}`,
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
 * Never freezes fallback on transient database errors.
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

		if (!calculation.isFallback) {
			memoryCache = calculation;
		}

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

		// Attach error and DO NOT save fallback into memoryCache or persistedSnapshotStore
		return {
			...fallbackCalc,
			error,
		};
	}
}

/**
 * Resolves the current estimated lead value:
 * 1. Fast in-memory cache accelerator.
 * 2. Shared monthly persisted snapshot (survives Worker instance recycling).
 * 3. On-demand database calculation if no snapshot exists yet.
 * Never freezes fallback on transient errors.
 */
export async function getEstimatedLeadValue(now = new Date()): Promise<number> {
	const currentMonth = formatMonthKey(now);

	// 1. Memory cache accelerator
	if (memoryCache && memoryCache.month === currentMonth && !memoryCache.isFallback) {
		return memoryCache.estimatedValue;
	}

	// 2. Persisted monthly snapshot
	const snapshot = await readPersistedSnapshot(currentMonth);
	if (snapshot && snapshot.month === currentMonth && !snapshot.isFallback) {
		memoryCache = snapshot;
		return snapshot.estimatedValue;
	}

	// 3. Ad-hoc computation if no snapshot exists yet
	const calculation = await computeMonthlyEstimatedLeadValue({ now });
	if (!calculation.isFallback && !calculation.error) {
		memoryCache = calculation;
	}
	return calculation.estimatedValue;
}

/**
 * Synchronous getter returning the cached value or the fallback constant.
 */
export function getEstimatedLeadValueSync(now = new Date()): number {
	const currentMonth = formatMonthKey(now);
	if (memoryCache && memoryCache.month === currentMonth && !memoryCache.isFallback) {
		return memoryCache.estimatedValue;
	}
	const persisted = getPersistedSnapshotSync(currentMonth);
	if (persisted && persisted.month === currentMonth && !persisted.isFallback) {
		memoryCache = persisted;
		return persisted.estimatedValue;
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

		if (!calculation.isFallback) {
			await writePersistedSnapshot(calculation);
			memoryCache = calculation;
		}

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
