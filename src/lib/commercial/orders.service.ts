import {
	createSalesOrder,
	findMetaConversionEventByEventId,
	findSalesOrderById,
	updateSalesOrderDepositPaid,
	upsertMetaConversionEvent,
	type MetaConversionEvent,
	type SalesOrder,
	type SalesOrderStatus,
} from '@/lib/commercial/orders.repository';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';

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
}

export interface MarkCommercialOrderDepositPaidInput {
	orderId: string;
	amountPaid: number;
	paidAt?: string;
}

export interface DepositPaidResult {
	order: SalesOrder;
	conversionEvent: MetaConversionEvent | null;
}

function assertPositiveAmount(value: number, message: string): void {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(message);
	}
}

function assertNonNegativeAmount(value: number | undefined, message: string): void {
	if (value === undefined) return;
	if (!Number.isFinite(value) || value < 0) {
		throw new Error(message);
	}
}

function assertMxnCurrency(currency: string | undefined): void {
	if (currency === undefined) return;
	if (currency.trim().toUpperCase() !== COMMERCIAL_ORDER_CURRENCY) {
		throw new Error('Commercial sales orders must use MXN currency.');
	}
}

function createPurchaseDepositEventId(orderId: string): string {
	return `purchase:${orderId}:deposit_paid`;
}

export function createOrderNumber(input: { now?: Date; randomSuffix?: string } = {}): string {
	const now = input.now ?? new Date();
	const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
	const suffix = input.randomSuffix?.trim().toUpperCase() || Math.random().toString(36).slice(2, 8).toUpperCase();
	return `CMO-${stamp}-${suffix}`;
}

export async function createCommercialSalesOrder(
	input: CreateCommercialSalesOrderInput,
): Promise<SalesOrder> {
	assertPositiveAmount(input.totalAmount, 'Total order amount must be greater than zero.');
	assertNonNegativeAmount(input.depositAmount, 'Deposit amount cannot be negative.');
	assertMxnCurrency(input.currency);

	return createSalesOrder({
		orderNumber: createOrderNumber({ now: input.now, randomSuffix: input.randomSuffix }),
		customerId: input.customerId,
		leadId: input.leadId,
		sessionId: input.sessionId,
		sourceEventId: input.sourceEventId,
		status: input.status ?? 'confirmed',
		eventType: input.eventType,
		packageId: input.packageId,
		packageName: input.packageName,
		currency: COMMERCIAL_ORDER_CURRENCY,
		totalAmount: input.totalAmount,
		depositAmount: input.depositAmount,
		createdBy: input.createdBy,
	});
}

export async function markCommercialOrderDepositPaid(
	input: MarkCommercialOrderDepositPaidInput,
): Promise<DepositPaidResult> {
	assertPositiveAmount(input.amountPaid, 'Deposit payment amount must be greater than zero.');

	const eventId = createPurchaseDepositEventId(input.orderId);
	const existingOrder = await findSalesOrderById(input.orderId);
	if (!existingOrder) {
		throw new Error('Sales order was not found.');
	}

	if (existingOrder.status === 'deposit_paid' || existingOrder.status === 'paid') {
		return {
			order: existingOrder,
			conversionEvent: await findMetaConversionEventByEventId(eventId),
		};
	}

	const paidAt = input.paidAt ?? new Date().toISOString();
	const order = await updateSalesOrderDepositPaid({
		orderId: input.orderId,
		amountPaid: input.amountPaid,
		paidAt,
	});
	const conversionEvent = await upsertMetaConversionEvent({
		orderId: order.id,
		leadId: order.leadId,
		customerId: order.customerId,
		eventName: 'Purchase',
		eventId,
		triggerStatus: 'deposit_paid',
		value: input.amountPaid,
		currency: COMMERCIAL_ORDER_CURRENCY,
	});

	if (conversionEvent) {
		void deliverMetaConversionEvent(conversionEvent.id).catch((err) => {
			console.error(`[orders-service] Failed to deliver CAPI event ${conversionEvent.id} synchronously:`, err);
		});
	}

	return { order, conversionEvent };
}
