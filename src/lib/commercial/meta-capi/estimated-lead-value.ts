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
 * While there is no data (or when DB is unavailable), a constant fallback value is used.
 *
 * Spec: .agent/tmp/reports/2026-10-25-client-loop-proposal.md (Section 8).
 */
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { safeErr } from '@/lib/server/safe-error';

export const DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN = 150;
export const ESTIMATED_LEAD_VALUE_CURRENCY = 'MXN';

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

let cachedCalculation: EstimatedLeadValueCalculation | null = null;

export function clearEstimatedLeadValueCache(): void {
	cachedCalculation = null;
}

export function setEstimatedLeadValueCache(calc: EstimatedLeadValueCalculation): void {
	cachedCalculation = calc;
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
 * Computes the monthly estimated lead value from Supabase leads and sales orders.
 */
export async function computeMonthlyEstimatedLeadValue(options?: {
	now?: Date;
	fallbackValue?: number;
}): Promise<EstimatedLeadValueCalculation> {
	const now = options?.now ?? new Date();
	const fallback = resolveFallbackLeadValue(options?.fallbackValue);

	try {
		const [leads, orders] = await Promise.all([
			supabaseRestRequest<StoredLeadRow[]>({
				pathWithQuery: 'leads?select=id,status',
				method: 'GET',
				useServiceRole: true,
			}),
			supabaseRestRequest<StoredOrderRow[]>({
				pathWithQuery: 'sales_orders?select=id,status,amount_paid,total_amount',
				method: 'GET',
				useServiceRole: true,
			}),
		]);

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

		cachedCalculation = calculation;
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
		cachedCalculation = fallbackCalc;
		return fallbackCalc;
	}
}

/**
 * Resolves the current estimated lead value (cached if for current month, or computed).
 * Never throws: falls back to DEFAULT_FALLBACK_ESTIMATED_LEAD_VALUE_MXN.
 */
export async function getEstimatedLeadValue(now = new Date()): Promise<number> {
	const currentMonth = formatMonthKey(now);
	if (cachedCalculation && cachedCalculation.month === currentMonth) {
		return cachedCalculation.estimatedValue;
	}
	const calculation = await computeMonthlyEstimatedLeadValue({ now });
	return calculation.estimatedValue;
}

/**
 * Synchronous getter returning the cached value or the fallback constant.
 */
export function getEstimatedLeadValueSync(now = new Date()): number {
	const currentMonth = formatMonthKey(now);
	if (cachedCalculation && cachedCalculation.month === currentMonth) {
		return cachedCalculation.estimatedValue;
	}
	return resolveFallbackLeadValue();
}

/**
 * Scheduled job runner that executes the monthly recalculation.
 */
export async function runMetaEstimatedLeadValueRecalculation(
	now = new Date(),
): Promise<'completed' | 'failed'> {
	try {
		const calculation = await computeMonthlyEstimatedLeadValue({ now });
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
