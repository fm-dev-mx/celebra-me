import type { SalesOrderStatus } from './orders.repository';

export const ORDER_STAGE_KEYS = [
	'quoted',
	'confirmed',
	'deposit',
	'data_received',
	'in_production',
	'published',
	'settled',
] as const;

export type OrderStageKey = (typeof ORDER_STAGE_KEYS)[number];

export const ORDER_STAGE_LABELS: Record<OrderStageKey, string> = {
	quoted: 'Cotizado',
	confirmed: 'Confirmado',
	deposit: 'Anticipo',
	data_received: 'Datos recibidos',
	in_production: 'En producción',
	published: 'Publicada',
	settled: 'Liquidado',
};

export type InvitationDataRequestStatus = 'sent' | 'in_progress' | 'submitted';
export type LinkedInvitationStatus =
	'draft' | 'in_production' | 'preview_sent' | 'approved' | 'published' | 'archived';

export interface OrderStageInput {
	status: SalesOrderStatus;
	amountPaid: number;
	dataRequestStatus?: InvitationDataRequestStatus | null;
	invitationStatus?: LinkedInvitationStatus | null;
}

export interface OrderStageStep {
	key: OrderStageKey;
	label: string;
	done: boolean;
}

export interface OrderStageProgress {
	/** The furthest stage reached, or null for a cancelled or lost order. */
	current: OrderStageKey | null;
	steps: OrderStageStep[];
}

const PRODUCTION_STATUSES = new Set<LinkedInvitationStatus>([
	'in_production',
	'preview_sent',
	'approved',
	'published',
]);

/**
 * Derives the seven-stage line from the order, its invitation data request and its invitation.
 * Each stage is reached on its own evidence (a published invitation does not need the data form,
 * a settled order does not need a published invitation), and the current stage is the last one
 * reached.
 */
export function deriveOrderStages(input: OrderStageInput): OrderStageProgress {
	const closed = input.status === 'cancelled' || input.status === 'lost';
	const invitation = input.invitationStatus ?? null;
	const published = invitation === 'published';
	const inProduction = invitation !== null && PRODUCTION_STATUSES.has(invitation);
	const dataReceived = input.dataRequestStatus === 'submitted' || inProduction;
	const deposit =
		input.status === 'deposit_paid' || input.status === 'paid' || input.amountPaid > 0;
	const confirmed = deposit || input.status === 'confirmed';
	const reached: Record<OrderStageKey, boolean> = {
		quoted: !closed,
		confirmed: !closed && confirmed,
		deposit: !closed && deposit,
		data_received: !closed && deposit && dataReceived,
		in_production: !closed && deposit && inProduction,
		published: !closed && deposit && published,
		settled: !closed && input.status === 'paid',
	};
	const steps = ORDER_STAGE_KEYS.map((key) => ({
		key,
		label: ORDER_STAGE_LABELS[key],
		done: reached[key],
	}));
	const last = [...steps].reverse().find((step) => step.done);
	return { current: last?.key ?? null, steps };
}
