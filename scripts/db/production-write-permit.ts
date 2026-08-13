/**
 * In-process Production write permit issued only after requireOwnerProductionApply.
 *
 * Not a second authorization mechanism: the owner TTY gate remains the positive
 * boundary. This permit only lets already-authorized in-process helpers spawn.
 */

import { extractSupabaseProjectRef } from './db-target-config.ts';
import {
	evaluateSpawnProductionMutation,
	type BoundaryDecision,
} from './production-boundary-policy.ts';

export interface ProductionWritePermit {
	issuedAt: string;
	expiresAtMs: number;
	pid: number;
	projectRef: string;
	operationType: string;
	bindingHex: string;
}

const PERMIT_TTL_MS = 30 * 60 * 1000;

let currentPermit: ProductionWritePermit | null = null;

export function issueProductionWritePermit(input: {
	projectRef: string;
	operationType: string;
	bindingHex: string;
	nowMs?: number;
}): ProductionWritePermit {
	const nowMs = input.nowMs ?? Date.now();
	currentPermit = {
		issuedAt: new Date(nowMs).toISOString(),
		expiresAtMs: nowMs + PERMIT_TTL_MS,
		pid: process.pid,
		projectRef: input.projectRef,
		operationType: input.operationType,
		bindingHex: input.bindingHex,
	};
	return currentPermit;
}

export function clearProductionWritePermit(): void {
	currentPermit = null;
}

export function getProductionWritePermit(): ProductionWritePermit | null {
	return currentPermit;
}

export function hasValidProductionWritePermit(
	dbUrl: string,
	nowMs: number = Date.now(),
	expectedBindingHex?: string,
): boolean {
	if (!currentPermit) return false;
	if (currentPermit.pid !== process.pid) return false;
	if (currentPermit.expiresAtMs < nowMs) return false;
	if (
		typeof expectedBindingHex === 'string' &&
		expectedBindingHex.length > 0 &&
		currentPermit.bindingHex !== expectedBindingHex
	) {
		return false;
	}
	try {
		return extractSupabaseProjectRef(dbUrl) === currentPermit.projectRef;
	} catch {
		return false;
	}
}

export type ProductionPermitMatch =
	| 'ok'
	| 'missing'
	| 'expired'
	| 'pid'
	| 'project'
	| 'binding';

/**
 * Classify why a delegated Production authorization may not be reused.
 * Does not accept caller-supplied booleans; the in-process permit is the only evidence.
 */
export function matchProductionWritePermit(input: {
	dbUrl: string;
	bindingHex: string;
	nowMs?: number;
}): ProductionPermitMatch {
	const nowMs = input.nowMs ?? Date.now();
	if (!currentPermit) return 'missing';
	if (currentPermit.pid !== process.pid) return 'pid';
	if (currentPermit.expiresAtMs < nowMs) return 'expired';
	if (currentPermit.bindingHex !== input.bindingHex) return 'binding';
	try {
		if (extractSupabaseProjectRef(input.dbUrl) !== currentPermit.projectRef) return 'project';
	} catch {
		return 'project';
	}
	return 'ok';
}

export function resolveSpawnProductionBoundary(
	command: string,
	args: readonly string[],
	options?: { input?: string; nowMs?: number },
): BoundaryDecision {
	const decision = evaluateSpawnProductionMutation(command, args, options);
	if (decision.permission === 'allow') return decision;
	if (decision.code !== 'PRODUCTION_WRITE_PERMIT_REQUIRED') return decision;
	const dbUrl =
		args.includes('--db-url') ? args[args.indexOf('--db-url') + 1] : undefined;
	const psqlUrl = args.includes('--dbname')
		? args[args.indexOf('--dbname') + 1]
		: args.find((arg) => /^postgres(ql)?:\/\//i.test(arg));
	const target = dbUrl ?? psqlUrl;
	if (target && hasValidProductionWritePermit(target, options?.nowMs)) {
		return { permission: 'allow' };
	}
	return decision;
}
