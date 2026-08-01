/** Shared deterministic aggregation for invitation, environment, and global summaries. */
import type { DeliveryStatus, OperationalStatus } from './types.ts';

const OPERATIONAL_PRECEDENCE: Record<OperationalStatus, number> = {
	HEALTHY: 0,
	ATTENTION: 1,
	UNVERIFIED: 2,
	BLOCKED: 3,
};

const DELIVERY_PRECEDENCE: Record<DeliveryStatus, number> = {
	ALIGNED: 0,
	IN_PROGRESS: 1,
	UNVERIFIED: 2,
	ACTION_REQUIRED: 3,
};

function aggregateByPrecedence<T extends string>(
	statuses: readonly T[],
	precedence: Readonly<Record<T, number>>,
	fallback: T,
): T {
	let result = fallback;
	for (const status of statuses) {
		if (precedence[status] > precedence[result]) result = status;
	}
	return result;
}

export function aggregateOperationalStatus(
	statuses: readonly OperationalStatus[],
): OperationalStatus {
	return aggregateByPrecedence(statuses, OPERATIONAL_PRECEDENCE, 'HEALTHY');
}

export function aggregateDeliveryStatus(statuses: readonly DeliveryStatus[]): DeliveryStatus {
	return aggregateByPrecedence(statuses, DELIVERY_PRECEDENCE, 'ALIGNED');
}

export function comparisonToDeliveryStatus(input: {
	outcome: 'APPLY' | 'ALREADY_APPLIED' | 'DRIFT' | 'DELIVERY_SCOPE_BLOCKED' | 'UNVERIFIED';
}): DeliveryStatus {
	switch (input.outcome) {
		case 'ALREADY_APPLIED':
			return 'ALIGNED';
		case 'APPLY':
			return 'IN_PROGRESS';
		case 'DRIFT':
		case 'DELIVERY_SCOPE_BLOCKED':
			return 'ACTION_REQUIRED';
		case 'UNVERIFIED':
			return 'UNVERIFIED';
	}
}
