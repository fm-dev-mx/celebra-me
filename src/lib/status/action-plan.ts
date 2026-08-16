import {
	authorizationRemediation,
	disposableRemediation,
	evidenceRemediation,
	manualPatchRemediation,
	publicationQueueRemediation,
	publicationRemediation,
	readinessRemediation,
	schemaRemediation,
	type OperatorActionStep,
	type OperatorRemediation,
} from './semantics';
import { ENV_LABELS } from './labels';
import { ENVS } from './evidence';
import { releasePromotions } from './promotion-lifecycle';
import type { CanonicalStatusView, StatusSemantic, TargetEnv } from './types';

export {
	authoringPromotions,
	authoringSlugSet,
	isAuthoringLifecycle,
	isAuthoringPromotion,
	partitionPromotions,
	releasePromotions,
} from './promotion-lifecycle';

export type OperationalActionDomain =
	'schema' | 'readiness' | 'authorization' | 'evidence' | 'publication' | 'patch' | 'disposable';

export type OperationalHealth = 'GREEN' | 'ACTION_REQUIRED' | 'UNVERIFIED';

export interface OperationalAction {
	id: string;
	domain: OperationalActionDomain;
	title: string;
	summary: string;
	semantic: StatusSemantic;
	priority: number;
	environments: string[];
	subject: string | null;
	steps: OperatorActionStep[];
	verifyWhen: string;
	why: string | null;
	noCanonicalRemediation: boolean;
}

export interface OperationalActionPlan {
	health: {
		status: OperationalHealth;
		label: string;
		summary: string;
		applicableChecks: number;
		unresolvedChecks: number;
	};
	actions: OperationalAction[];
}

export function hasPendingSchemaWork(view: CanonicalStatusView): boolean {
	return ENVS.some((environment) => {
		const row = view.environments[environment];
		return (
			row.schemaLifecycle === 'BEHIND' ||
			row.pendingMigrations.length > 0 ||
			row.schemaOperationReadiness === 'PENDING_MIGRATIONS'
		);
	});
}

function actionPriority(remediation: OperatorRemediation): number {
	if (remediation.semantic === 'blocked') return 0;
	if (remediation.semantic === 'unverified') return 1;
	return 2;
}

function uniqueSteps(steps: OperatorActionStep[]): OperatorActionStep[] {
	const seen = new Set<string>();
	return steps.filter((item) => {
		const key = `${item.type}|${item.command ?? ''}|${item.prerequisite ?? ''}|${item.requiresOwner}|${item.optional}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function actionKey(action: OperationalAction): string | null {
	const first = action.steps.find((step) => step.command || step.prerequisite);
	if (!first) return null;
	const subject = action.domain === 'patch' ? `|${action.subject ?? action.title}` : '';
	return `${first.command ?? ''}|${first.prerequisite ?? ''}|${first.requiresOwner}${subject}`;
}

function mergeActions(actions: OperationalAction[]): OperationalAction[] {
	const merged: OperationalAction[] = [];
	const byKey = new Map<string, OperationalAction>();
	for (const action of actions) {
		const key = actionKey(action);
		if (!key) {
			merged.push(action);
			continue;
		}
		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, action);
			merged.push(action);
			continue;
		}
		existing.environments = [...new Set([...existing.environments, ...action.environments])];
		existing.steps = uniqueSteps([...existing.steps, ...action.steps]);
		existing.priority = Math.min(existing.priority, action.priority);
		existing.semantic =
			existing.semantic === 'blocked' || action.semantic === 'blocked'
				? 'blocked'
				: existing.semantic === 'unverified' || action.semantic === 'unverified'
					? 'unverified'
					: existing.semantic;
		existing.noCanonicalRemediation =
			existing.noCanonicalRemediation && action.noCanonicalRemediation;
		if (existing.why !== action.why && action.why) {
			existing.why = existing.why ? `${existing.why} · ${action.why}` : action.why;
		}
	}
	return merged.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, 'es'));
}

function toAction(
	id: string,
	domain: OperationalActionDomain,
	title: string,
	remediation: OperatorRemediation,
	environment: string,
	subject: string | null = null,
): OperationalAction | null {
	if (remediation.semantic === 'verified' || remediation.semantic === 'neutral') return null;
	return {
		id,
		domain,
		title,
		summary: remediation.nextAction,
		semantic: remediation.semantic,
		priority: actionPriority(remediation),
		environments: [environment],
		subject,
		steps: uniqueSteps(remediation.steps),
		verifyWhen: remediation.verifyWhen,
		why: remediation.why,
		noCanonicalRemediation: remediation.noCanonicalRemediation,
	};
}

function addAction(actions: OperationalAction[], action: OperationalAction | null): void {
	if (action) actions.push(action);
}

export function aggregateManualPatchStatus(
	view: CanonicalStatusView,
	environment: TargetEnv,
): {
	label: string;
	semantic: StatusSemantic;
} {
	const statuses = view.manualPatches.map((patch) => patch.environments[environment].status);
	const blocked = statuses.filter((status) => status === 'BLOCKED').length;
	const unverified = statuses.filter((status) => status === 'UNVERIFIED').length;
	const pending = statuses.filter((status) => status === 'PENDING').length;
	const notNeeded = statuses.filter((status) => status === 'NOT_NEEDED').length;
	const notApplicable = statuses.filter((status) => status === 'NOT_APPLICABLE').length;
	if (blocked > 0) return { label: `${blocked} bloqueado(s)`, semantic: 'blocked' };
	if (unverified > 0) return { label: `${unverified} sin verificar`, semantic: 'unverified' };
	if (pending > 0) return { label: `${pending} pendiente(s)`, semantic: 'blocked' };
	if (notNeeded > 0) return { label: `${notNeeded} no requerido(s)`, semantic: 'verified' };
	return { label: `${notApplicable} no aplica`, semantic: 'neutral' };
}

function isControlHealthy(view: CanonicalStatusView): boolean {
	if (view.evidence !== 'LIVE') return false;
	for (const environment of ENVS) {
		const row = view.environments[environment];
		if (row.evidence !== 'LIVE') return false;
		if (schemaRemediation(row).semantic !== 'verified') return false;
		if (readinessRemediation(row).semantic !== 'verified') return false;
		if (row.authorizationIntegrity === 'UNVERIFIED') return false;
	}
	if (releasePromotions(view.promotions).length > 0) return false;
	return view.manualPatches.every((patch) =>
		ENVS.every((environment) => {
			const status = patch.environments[environment].status;
			return status === 'NOT_APPLICABLE' || status === 'NOT_NEEDED';
		}),
	);
}

export function buildOperationalActionPlan(view: CanonicalStatusView): OperationalActionPlan {
	const actions: OperationalAction[] = [];
	if (hasPendingSchemaWork(view)) {
		addAction(
			actions,
			toAction(
				'disposable-proof',
				'disposable',
				'Prueba disposable',
				disposableRemediation(view.disposableProof),
				'disposable-test',
			),
		);
	}

	for (const environment of ENVS) {
		const row = view.environments[environment];
		addAction(
			actions,
			toAction(
				`schema-${environment}`,
				'schema',
				`Migraciones · ${ENV_LABELS[environment]}`,
				schemaRemediation(row),
				ENV_LABELS[environment],
			),
		);
		addAction(
			actions,
			toAction(
				`readiness-${environment}`,
				'readiness',
				`Preparación · ${ENV_LABELS[environment]}`,
				readinessRemediation(row),
				ENV_LABELS[environment],
			),
		);
		addAction(
			actions,
			toAction(
				`evidence-${environment}`,
				'evidence',
				`Evidencia · ${ENV_LABELS[environment]}`,
				evidenceRemediation(row),
				ENV_LABELS[environment],
			),
		);
		addAction(
			actions,
			toAction(
				`authorization-${environment}`,
				'authorization',
				`Autorización · ${ENV_LABELS[environment]}`,
				authorizationRemediation(row),
				ENV_LABELS[environment],
			),
		);
	}

	const queue = releasePromotions(view.promotions);
	if (queue.length === 0) {
		addAction(
			actions,
			toAction(
				'publication-queue',
				'publication',
				'Publicación',
				publicationQueueRemediation(view),
				'registro',
			),
		);
	} else {
		for (const promotion of queue) {
			addAction(
				actions,
				toAction(
					`publication-${promotion.slug}`,
					'publication',
					`Publicación · ${promotion.title}`,
					publicationRemediation(promotion),
					'registro',
					promotion.slug,
				),
			);
		}
	}

	for (const patch of view.manualPatches) {
		for (const environment of ENVS) {
			const remediation = manualPatchRemediation(patch, environment);
			addAction(
				actions,
				toAction(
					`patch-${patch.scriptId}-${environment}`,
					'patch',
					`Parche · ${patch.file.split('/').at(-1) ?? patch.scriptId}`,
					remediation,
					ENV_LABELS[environment],
					patch.scriptId,
				),
			);
		}
	}

	const mergedActions = mergeActions(actions);
	const unresolvedChecks = mergedActions.length;
	const applicableChecks = ENVS.length * 4 + 2 + queue.length + view.manualPatches.length;
	const hasBlocked = mergedActions.some((action) => action.semantic === 'blocked');
	const status: OperationalHealth = isControlHealthy(view)
		? 'GREEN'
		: hasBlocked
			? 'ACTION_REQUIRED'
			: 'UNVERIFIED';
	const label =
		status === 'GREEN'
			? 'Todo en orden'
			: status === 'ACTION_REQUIRED'
				? 'Acciones necesarias'
				: 'Verificación pendiente';
	const summary =
		status === 'GREEN'
			? 'Controles aplicables verificados con evidencia en vivo; no hay migraciones, promociones ni parches pendientes.'
			: `${unresolvedChecks} acción(es) priorizada(s) para alcanzar un estado operativo verde.`;
	return {
		health: { status, label, summary, applicableChecks, unresolvedChecks },
		actions: mergedActions,
	};
}
