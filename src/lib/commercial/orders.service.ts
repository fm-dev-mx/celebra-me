import {
	createSalesOrder,
	registerSalesOrderDepositPurchase,
	type MetaConversionEvent,
	type SalesOrder,
	type SalesOrderStatus,
} from '@/lib/commercial/orders.repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import { randomUUID } from 'node:crypto';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import { emitCommercialTrackingEvent } from '@/lib/commercial/commercial-tracking';

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

export function createOrderNumber(input: { now?: Date; randomSuffix?: string } = {}): string {
	const now = input.now ?? new Date();
	const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
	const suffix =
		input.randomSuffix?.trim().toUpperCase() ||
		Math.random().toString(36).slice(2, 8).toUpperCase();
	return `CMO-${stamp}-${suffix}`;
}

export async function createCommercialSalesOrder(
	input: CreateCommercialSalesOrderInput,
): Promise<SalesOrder> {
	assertPositiveAmount(input.totalAmount, 'Total order amount must be greater than zero.');
	assertNonNegativeAmount(input.depositAmount, 'Deposit amount cannot be negative.');
	assertMxnCurrency(input.currency);

	return createSalesOrder({
		idempotencyKey: input.idempotencyKey ?? randomUUID(),
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
	})
		.catch((error: unknown) => {
			if (error instanceof Error && error.message.includes('ORDER_IDEMPOTENCY_CONFLICT')) {
				throw new ApiError(
					409,
					'conflict',
					'La solicitud ya se usó para crear una orden con datos diferentes.',
				);
			}
			throw error;
		})
		.then((order) => {
			// Fire-and-forget: emit internal order_created tracking event.
			if (order.wasCreated !== false)
				void emitCommercialTrackingEvent({
					eventName: 'order_created',
					customerId: order.customerId,
					orderId: order.id,
					sessionId: order.sessionId,
					totalAmount: order.totalAmount,
				});
			return order;
		});
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

	if (!result.idempotent) {
		void deliverMetaConversionEvent(conversionEvent.id).catch((err) => {
			console.error(
				`[orders-service] Failed to deliver CAPI event ${conversionEvent.id} synchronously:`,
				err,
			);
		});
	}

	// Fire-and-forget: emit internal deposit_paid tracking event (skip on idempotent re-process).
	if (!result.idempotent) {
		void emitCommercialTrackingEvent({
			eventName: 'deposit_paid',
			customerId: order.customerId,
			orderId: order.id,
			sessionId: order.sessionId,
			totalAmount: order.totalAmount,
			amountPaid: input.amountPaid,
		});
	}

	return { order, conversionEvent };
}
