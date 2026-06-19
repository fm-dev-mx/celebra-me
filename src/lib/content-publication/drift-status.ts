export type DemoDriftStatus =
	| 'in_sync'
	| 'different'
	| 'missing_in_prod'
	| 'missing_locally'
	| 'schema_mismatch'
	| 'unsafe_target';

export interface DemoDriftStatusInput {
	hasLocal: boolean;
	hasProd: boolean;
	localValid?: boolean;
	prodIsDemo?: boolean | null;
	localHash?: string | null;
	prodHash?: string | null;
}

/** Returns true when the given drift status represents a publishable demo. */
export function canPublishByStatus(status: DemoDriftStatus): boolean {
	return status === 'different';
}

export function classifyDemoDriftStatus(input: DemoDriftStatusInput): DemoDriftStatus {
	if (input.hasProd && input.prodIsDemo === false) return 'unsafe_target';
	if (input.hasLocal && input.localValid === false) return 'schema_mismatch';
	if (!input.hasLocal && input.hasProd) return 'missing_locally';
	if (input.hasLocal && !input.hasProd) return 'missing_in_prod';
	if (input.localHash && input.prodHash && input.localHash === input.prodHash) return 'in_sync';
	return 'different';
}
