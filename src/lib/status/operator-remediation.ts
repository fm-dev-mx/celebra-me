import type { StatusSemantic, TargetEnv } from './types';

type OperatorStepType = 'Diagnose' | 'Verify' | 'Plan' | 'Apply' | 'Manual/HITL';

export interface OperatorActionStep {
	type: OperatorStepType;
	label: string;
	command: string | null;
	prerequisite: string | null;
	requiresOwner: boolean;
	optional: boolean;
}

export interface OperatorRemediation {
	semantic: StatusSemantic;
	meaning: string;
	why: string | null;
	environmentLabel: string | null;
	nextAction: string;
	steps: OperatorActionStep[];
	verifyWhen: string;
	noCanonicalRemediation: boolean;
}

const REFRESH_COMMAND = 'pnpm dbs';

export function step(
	type: OperatorStepType,
	command: string | null,
	prerequisite: string | null,
	requiresOwner = false,
	optional = false,
	label: string = type,
): OperatorActionStep {
	return { type, label, command, prerequisite, requiresOwner, optional };
}

export function noneNeeded(meaning: string, environmentLabel: string | null): OperatorRemediation {
	return {
		semantic: 'verified',
		meaning,
		why: null,
		environmentLabel,
		nextAction: 'No se requiere intervención.',
		steps: [],
		verifyWhen: meaning,
		noCanonicalRemediation: false,
	};
}

export function unverifiedRefresh(
	meaning: string,
	why: string,
	environmentLabel: string | null,
	verifyWhen: string,
): OperatorRemediation {
	return {
		semantic: 'unverified',
		meaning,
		why,
		environmentLabel,
		nextAction:
			'Obtenga evidencia de solo lectura. Esta consulta no aplica migraciones ni promociones.',
		steps: [
			step(
				'Diagnose',
				REFRESH_COMMAND,
				'Consulta read-only; no ejecuta mutaciones.',
				false,
				false,
				'Revalidar evidencia',
			),
		],
		verifyWhen,
		noCanonicalRemediation: false,
	};
}

export function identityDiagnoseCommand(env: TargetEnv): string | null {
	if (env === 'production') return null;
	return `pnpm invitation:diagnose-identity -- --target ${env}`;
}
