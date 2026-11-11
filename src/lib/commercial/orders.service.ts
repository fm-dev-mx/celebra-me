import {
	createSalesOrder,
	findSalesOrderByIdempotencyKey,
	redeemCustomerReferralCredit,
	registerSalesOrderDepositPurchase,
	type MetaConversionEvent,
	type SalesOrder,
	type SalesOrderStatus,
} from '@/lib/commercial/orders.repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import { randomUUID } from 'node:crypto';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import { enqueueOrderSettledEvent } from '@/lib/commercial/meta-capi/order-settled';
import { emitCommercialTrackingEvent } from '@/lib/commercial/commercial-tracking';
import { runAfterResponse, type AfterResponseContext } from '@/lib/server/platform-request';
import { safeErr } from '@/lib/server/safe-error';
import {
	findLeadOrderAttribution,
	markLeadAsPastSale,
	type LeadOrderAttribution,
} from '@/lib/tracking/lead.repository';
import { enqueueMetaCrmLeadStageEvent } from '@/lib/commercial/meta-capi/lead-stage-events';
import {
	findCommercialCustomerById,
	findCommercialCustomerByReferralCode,
} from '@/lib/commercial/customer.repository';
import {
	applyReferrerCreditPricing,
	calculateFriendReferralPricing,
	normalizeReferralCode,
} from '@/lib/commercial/referrals';

const COMMERCIAL_ORDER_CURRENCY = 'MXN';

export interface CreateCommercialSalesOrderInput {
	customerId: string;
	leadId?: string;
	sessionId?: string;
	sourceEventId?: string;
	status?: Extract<SalesOrderStatus, 'quoted' | 'confirmed'>;
	eventType: string;
	packageId?: string;
	packageName?: string;
	currency?: string;
	totalAmount: number;
	depositAmount?: number;
	createdBy?: string;
	now?: Date;
	randomSuffix?: string;
	idempotencyKey?: string;
	isPastSale?: boolean;
	soldAt?: string;
	referredByCustomerId?: string;
	referralCodeUsed?: string;
	discountAmount?: number;
	applyReferralDiscount?: boolean;
	applyReferrerCredit?: boolean;
}

export interface MarkCommercialOrderDepositPaidInput {
	orderId: string;
	amountPaid: number;
	paidAt?: string;
	actorId?: string;
	idempotencyKey?: string;
}

export interface DepositPaidResult {
	order: SalesOrder;
	conversionEvent: MetaConversionEvent | null;
}

/** Request-scoped options; `after` keeps background work alive once the response is sent. */
export interface CommercialOrderServiceOptions {
	after?: AfterResponseContext | null;
}

function assertPositiveAmount(value: number, message: string): void {
	if (!Number.isFinite(value) || value <= 0) {
		throw new ApiError(400, 'validation_error', message);
	}
}

function assertNonNegativeAmount(value: number | undefined, message: string): void {
	if (value === undefined) return;
	if (!Number.isFinite(value) || value < 0) {
		throw new ApiError(400, 'validation_error', message);
	}
}

function assertMxnCurrency(currency: string | undefined): void {
	if (currency === undefined) return;
	if (currency.trim().toUpperCase() !== COMMERCIAL_ORDER_CURRENCY) {
		throw new ApiError(
			400,
			'validation_error',
			'Commercial sales orders must use MXN currency.',
		);
	}
}

function createOrderNumber(input: { now?: Date; randomSuffix?: string } = {}): string {
	const now = input.now ?? new Date();
	const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
	const suffix =
		input.randomSuffix?.trim().toUpperCase() ||
		Math.random().toString(36).slice(2, 8).toUpperCase();
	return `CMO-${stamp}-${suffix}`;
}

/**
 * Fills the order's lead and visitor session from the selected lead, or from the customer's
 * latest lead, so the Purchase sent at deposit time carries that session's Meta cookies and
 * follows that lead's marketing consent. A failed lookup never blocks the order.
 */
async function resolveOrderAttribution(
	input: CreateCommercialSalesOrderInput,
): Promise<Partial<LeadOrderAttribution>> {
	const leadId = input.leadId?.trim() || undefined;
	const sessionId = input.sessionId?.trim() || undefined;
	if (sessionId && leadId) return { leadId, sessionId };
	try {
		const attribution = await findLeadOrderAttribution({
			leadId,
			customerId: input.customerId,
		});
		if (!attribution) return { leadId, sessionId };
		return {
			leadId: attribution.leadId,
			sessionId: sessionId ?? attribution.sessionId ?? undefined,
			isPastSale: attribution.isPastSale,
			referredByCustomerId: attribution.referredByCustomerId,
			referralCodeUsed: attribution.referralCodeUsed,
		};
	} catch (error) {
		console.error('[orders-service] Lead attribution lookup failed:', safeErr(error));
		return { leadId, sessionId };
	}
}

const ORDER_IDEMPOTENCY_CONFLICT_MESSAGE =
	'La solicitud ya se usó para crear una orden con datos diferentes.';

async function findReplayedOrder(
	input: CreateCommercialSalesOrderInput,
): Promise<SalesOrder | null> {
	if (!input.idempotencyKey) return null;
	const existing = await findSalesOrderByIdempotencyKey(input.idempotencyKey);
	if (!existing) return null;
	if (existing.customerId !== input.customerId) {
		throw new ApiError(409, 'conflict', ORDER_IDEMPOTENCY_CONFLICT_MESSAGE);
	}
	return { ...existing, wasCreated: false };
}

/** Resolves the referrer from the input, the lead or the code; a customer never refers themself. */
async function resolveReferrer(
	input: CreateCommercialSalesOrderInput,
	attribution: Partial<LeadOrderAttribution>,
): Promise<{ referredByCustomerId?: string; referralCodeUsed?: string }> {
	let referredByCustomerId =
		input.referredByCustomerId || attribution.referredByCustomerId || undefined;
	const referralCodeUsed = normalizeReferralCode(
		input.referralCodeUsed || attribution.referralCodeUsed,
	);
	if (referralCodeUsed && !referredByCustomerId) {
		try {
			const referrer = await findCommercialCustomerByReferralCode(referralCodeUsed);
			referredByCustomerId = referrer?.id;
		} catch (error) {
			console.error('[orders-service] Referrer customer lookup failed:', safeErr(error));
		}
	}
	if (referredByCustomerId === input.customerId) referredByCustomerId = undefined;
	return { referredByCustomerId, referralCodeUsed };
}

interface OrderPricing {
	discountAmount: number;
	netTotalAmount: number;
	referrerCreditRedeemed: number;
}

async function findCustomerReferralCredit(customerId: string): Promise<number> {
	const customer = await findCommercialCustomerById(customerId).catch((error: unknown) => {
		console.error('[orders-service] Customer credit lookup failed:', safeErr(error));
		return null;
	});
	return customer?.referralCreditMxn ?? 0;
}

/** Prices the order net of the friend discount and the customer's own referral credit. */
async function priceOrder(
	input: CreateCommercialSalesOrderInput,
	isPastSale: boolean,
	referredByCustomerId: string | undefined,
): Promise<OrderPricing> {
	if (input.discountAmount !== undefined) {
		const discountAmount = Math.max(0, input.discountAmount);
		return {
			discountAmount,
			netTotalAmount: Math.max(1, input.totalAmount - discountAmount),
			referrerCreditRedeemed: 0,
		};
	}
	const pricing: OrderPricing = {
		discountAmount: 0,
		netTotalAmount: input.totalAmount,
		referrerCreditRedeemed: 0,
	};
	// Past sales keep the price that was really charged; rewards apply to new sales only.
	if (isPastSale) return pricing;
	if (referredByCustomerId && input.applyReferralDiscount !== false) {
		const friend = calculateFriendReferralPricing(input.totalAmount);
		pricing.discountAmount = friend.discountAmount;
		pricing.netTotalAmount = friend.netTotalAmount;
	}
	if (input.applyReferrerCredit === false) return pricing;
	const credit = await findCustomerReferralCredit(input.customerId);
	if (credit > 0) {
		const redeemed = applyReferrerCreditPricing(pricing.netTotalAmount, credit);
		pricing.referrerCreditRedeemed = redeemed.discountAmount;
		pricing.discountAmount += redeemed.discountAmount;
		pricing.netTotalAmount = redeemed.netTotalAmount;
	}
	return pricing;
}

async function finishCreatedOrder(
	order: SalesOrder,
	referrerCreditRedeemed: number,
	isPastSale: boolean,
	options: CommercialOrderServiceOptions,
): Promise<void> {
	if (referrerCreditRedeemed > 0) {
		const redeemed = await redeemCustomerReferralCredit(
			order.customerId,
			referrerCreditRedeemed,
		).catch((error: unknown) => {
			console.error('[orders-service] Referral credit redemption failed:', safeErr(error));
			return false;
		});
		if (!redeemed)
			console.error(
				`[orders-service] Order ${order.id} discounts ${referrerCreditRedeemed} MXN of referral credit that could not be spent.`,
			);
	}
	if (isPastSale && order.leadId) {
		await markLeadAsPastSale(order.leadId).catch((error: unknown) => {
			console.error('[orders-service] Past-sale lead flag failed:', safeErr(error));
		});
	}
	// Background: emit the internal order_created tracking event after the response.
	runAfterResponse(
		options.after,
		() =>
			emitCommercialTrackingEvent({
				eventName: 'order_created',
				customerId: order.customerId,
				orderId: order.id,
				sessionId: order.sessionId,
				totalAmount: order.totalAmount,
			}),
		{ label: 'orders-service:order_created' },
	);
}

export async function createCommercialSalesOrder(
	input: CreateCommercialSalesOrderInput,
	options: CommercialOrderServiceOptions = {},
): Promise<SalesOrder> {
	assertPositiveAmount(input.totalAmount, 'Total order amount must be greater than zero.');
	assertNonNegativeAmount(input.depositAmount, 'Deposit amount cannot be negative.');
	assertMxnCurrency(input.currency);

	// A replayed request returns the stored order before any pricing is recomputed, so a credit
	// spent by the first request never changes the replay's total.
	const replayed = await findReplayedOrder(input);
	if (replayed) return replayed;

	const idempotencyKey = input.idempotencyKey ?? randomUUID();
	const attribution = await resolveOrderAttribution(input);
	const isPastSale = input.isPastSale ?? attribution.isPastSale ?? false;
	const soldAt = isPastSale
		? (input.soldAt ?? (input.now ?? new Date()).toISOString())
		: undefined;
	const { referredByCustomerId, referralCodeUsed } = await resolveReferrer(input, attribution);
	const pricing = await priceOrder(input, isPastSale, referredByCustomerId);

	const order = await createSalesOrder({
		idempotencyKey,
		orderNumber: createOrderNumber({ now: input.now, randomSuffix: input.randomSuffix }),
		customerId: input.customerId,
		leadId: attribution.leadId,
		sessionId: attribution.sessionId ?? undefined,
		sourceEventId: input.sourceEventId,
		status: input.status ?? 'confirmed',
		eventType: input.eventType,
		packageId: input.packageId,
		packageName: input.packageName,
		currency: COMMERCIAL_ORDER_CURRENCY,
		totalAmount: pricing.netTotalAmount,
		depositAmount: input.depositAmount,
		createdBy: input.createdBy,
		isPastSale,
		soldAt,
		referredByCustomerId,
		referralCodeUsed,
		discountAmount: pricing.discountAmount,
		referrerCreditRedeemed: pricing.referrerCreditRedeemed,
	}).catch((error: unknown) => {
		if (error instanceof Error && error.message.includes('ORDER_IDEMPOTENCY_CONFLICT')) {
			throw new ApiError(409, 'conflict', ORDER_IDEMPOTENCY_CONFLICT_MESSAGE);
		}
		throw error;
	});
	if (order.wasCreated !== false) {
		await finishCreatedOrder(order, pricing.referrerCreditRedeemed, isPastSale, options);
	}
	return order;
}

function mapDepositTransitionError(error: unknown): never {
	const message = error instanceof Error ? error.message : String(error);
	const databaseMessage = message.match(/"message"\s*:\s*"([^"]+)"/i)?.[1] ?? message;
	if (message.includes('No se encontró la orden de venta')) {
		throw new ApiError(404, 'not_found', 'No se encontró la orden de venta.');
	}
	if (
		message.includes('datos diferentes') ||
		message.includes('no coincide con el anticipo') ||
		message.includes('no tiene su evento Purchase')
	) {
		throw new ApiError(409, 'conflict', databaseMessage);
	}
	if (
		message.includes('No se puede registrar un anticipo') ||
		message.includes('El anticipo no puede ser mayor') ||
		message.includes('clave de idempotencia')
	) {
		throw new ApiError(400, 'validation_error', databaseMessage);
	}
	throw error;
}

export async function markCommercialOrderDepositPaid(
	input: MarkCommercialOrderDepositPaidInput,
	options: CommercialOrderServiceOptions = {},
): Promise<DepositPaidResult> {
	assertPositiveAmount(input.amountPaid, 'El monto del anticipo debe ser mayor a cero.');

	const paidAt = input.paidAt ?? new Date().toISOString();
	let result: Awaited<ReturnType<typeof registerSalesOrderDepositPurchase>>;
	try {
		result = await registerSalesOrderDepositPurchase({
			orderId: input.orderId,
			amountPaid: input.amountPaid,
			paidAt,
			actorId: input.actorId ?? randomUUID(),
			idempotencyKey: input.idempotencyKey ?? randomUUID(),
		});
	} catch (error) {
		mapDepositTransitionError(error);
	}
	const { order, conversionEvent } = result;

	// Background work after the response (skipped on an idempotent re-run or past sales): first CAPI
	// delivery of the conversion event, then the internal deposit_paid tracking event.
	if (!result.idempotent && conversionEvent && !order.isPastSale) {
		runAfterResponse(options.after, () => deliverMetaConversionEvent(conversionEvent.id), {
			label: `orders-service:capi:${conversionEvent.id}`,
		});
	}
	if (!result.idempotent) {
		runAfterResponse(
			options.after,
			() =>
				emitCommercialTrackingEvent({
					eventName: 'deposit_paid',
					customerId: order.customerId,
					orderId: order.id,
					sessionId: order.sessionId,
					totalAmount: order.totalAmount,
					amountPaid: input.amountPaid,
				}),
			{ label: 'orders-service:deposit_paid' },
		);
	}
	// A deposit that covers the total settles the order: queue its own event (no value, the
	// Purchase already carried the total). Idempotent by order, so a re-run never sends it twice.
	if (order.amountPaid >= order.totalAmount && !order.isPastSale) {
		runAfterResponse(
			options.after,
			async () => {
				const settledId = await enqueueOrderSettledEvent({
					orderId: order.id,
					customerId: order.customerId,
					leadId: order.leadId ?? null,
				});
				if (settledId) await deliverMetaConversionEvent(settledId);
			},
			{ label: `orders-service:order-settled:${order.id}` },
		);
	}
	const leadId = order.leadId;
	if (leadId && !order.isPastSale) {
		runAfterResponse(
			options.after,
			() => enqueueMetaCrmLeadStageEvent({ leadId, stage: 'paid' }),
			{ label: `orders-service:meta-crm-lead-stage:${leadId}` },
		);
	}

	return { order, conversionEvent };
}
