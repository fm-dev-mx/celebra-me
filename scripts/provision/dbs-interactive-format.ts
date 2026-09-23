/** Pure, color-aware invitation detail for the read-only dbs navigator. */
import type { OperationalAction, OperationalActionPlan } from '../../src/lib/status/action-plan.ts';
import type { CanonicalStatusView } from '../../src/lib/status/types.ts';
import type { MediaReferencesStatus } from '../../src/lib/status/media-reference-types.ts';
import { useCliColor } from '../db/operator-cli-ux.ts';
import {
	buildInvitationChoices,
	invitationEnvironmentStatus,
	type InvitationChoice,
	type InvitationEnvironmentStatus,
} from './dbs-interactive-model.ts';

type DetailInput = {
	choice: InvitationChoice;
	view: CanonicalStatusView;
	media: MediaReferencesStatus;
	plan: OperationalActionPlan;
	env?: NodeJS.ProcessEnv;
};

function paint(code: string, value: string, enabled: boolean): string {
	return enabled ? `\x1b[${code}m${value}\x1b[0m` : value;
}

function colorEnabled(env: NodeJS.ProcessEnv): boolean {
	if (env.NO_COLOR || env.FORCE_COLOR === '0' || env.FORCE_COLOR === 'false') return false;
	return useCliColor(env) || Boolean(process.stdout.isTTY);
}

function wrap(value: string, width = 68): string[] {
	const lines: string[] = [];
	let current = '';
	for (const word of value.split(/\s+/u)) {
		if (current && `${current} ${word}`.length > width) {
			lines.push(current);
			current = word;
		} else current = current ? `${current} ${word}` : word;
	}
	if (current) lines.push(current);
	return lines;
}

function statusLabel(status: InvitationEnvironmentStatus): {
	icon: string;
	text: string;
	code: string;
} {
	switch (status) {
		case 'CURRENT':
			return { icon: '✓', text: 'Al día', code: '32' };
		case 'UPDATE_PENDING':
			return { icon: '●', text: 'Actualización pendiente', code: '33' };
		case 'MEDIA_REVIEW':
			return { icon: '●', text: 'Referencias por revisar', code: '33' };
		case 'BOTH':
			return { icon: '●', text: 'Publicación y referencias pendientes', code: '33' };
		case 'UNVERIFIED':
			return { icon: '?', text: 'Sin verificar', code: '33' };
	}
}

function relevantActions(input: DetailInput): OperationalAction[] {
	return input.plan.actions.filter(
		(action) =>
			(action.domain === 'publication' || action.domain === 'media') &&
			action.subject === input.choice.slug &&
			(action.domain !== 'media' ||
				action.environments.some(
					(env) =>
						(env === 'preview' || env === 'production') &&
						input.media[env]?.findings.some(
							(finding) => finding.route === input.choice.route,
						),
				)),
	);
}

function formatAction(action: OperationalAction, enabled: boolean): string[] {
	const lines = [`  ${paint('1', action.title, enabled)}`];
	for (const step of action.steps) {
		const label = step.requiresOwner
			? `${step.label} · autorización del propietario`
			: step.label;
		lines.push(`    ${paint(step.requiresOwner ? '33' : '36', label, enabled)}`);
		if (step.command)
			lines.push(`      ${paint(step.requiresOwner ? '33' : '36', step.command, enabled)}`);
		if (step.prerequisite) {
			const condition = /^Solo si\b/iu.test(step.prerequisite)
				? step.prerequisite
				: `Condición: ${step.prerequisite}`;
			for (const line of wrap(condition)) lines.push(`      ${paint('2', line, enabled)}`);
		}
	}
	return lines;
}

export function formatInvitationDetail(input: DetailInput): string {
	const enabled = colorEnabled(input.env ?? process.env);
	const { choice, view, media } = input;
	const ambiguous =
		buildInvitationChoices(view, media).filter((item) => item.slug === choice.slug).length > 1;
	const lines = [
		'',
		paint('1;36', `INVITACIÓN  ${choice.label}`, enabled),
		paint('2', `Ruta: /${choice.route}`, enabled),
		'────────────────────────────────────────',
		paint('1', 'ESTADO POR AMBIENTE', enabled),
	];
	for (const env of ['local', 'preview', 'production'] as const) {
		const status = invitationEnvironmentStatus(choice, env, view, media);
		const { icon, text, code } = statusLabel(status);
		const envName =
			env === 'production' ? 'Producción' : env === 'preview' ? 'Preview' : 'Local';
		lines.push(
			`  ${paint(code, icon, enabled)} ${envName.padEnd(12)} ${paint(code, text, enabled)}`,
		);
		if (env !== 'local') {
			const findings =
				media[env]?.findings.filter((finding) => finding.route === choice.route) ?? [];
			const missing = findings.filter((finding) => finding.issue === 'MISSING_ASSET').length;
			const drift = findings.length - missing;
			if (missing)
				lines.push(`    ${paint('31', `${missing} asset(s) sin fila activa`, enabled)}`);
			if (drift)
				lines.push(`    ${paint('33', `${drift} referencia(s) distintas`, enabled)}`);
		}
	}
	lines.push('────────────────────────────────────────');
	if (ambiguous) {
		lines.push(
			paint(
				'33',
				'Slug compartido: revise el tipo de evento antes de usar comandos.',
				enabled,
			),
		);
	} else {
		const actions = relevantActions(input);
		if (actions.length > 0) {
			lines.push(paint('1', 'PRÓXIMOS PASOS · solo lectura', enabled));
			for (const action of actions) lines.push(...formatAction(action, enabled));
		}
	}
	lines.push(paint('2', 'Los comandos no se ejecutan aquí.', enabled));
	lines.push(paint('2', 'La entrega y el SHA-256 requieren auditoría completa.', enabled));
	return lines.join('\n') + '\n';
}
