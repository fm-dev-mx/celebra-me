/** Read-only terminal navigation for dbs. Prompt choices never execute remedies. */
import { search, select } from '@inquirer/prompts';
import {
	buildOperationalActionPlan,
	type OperationalActionPlan,
} from '../../src/lib/status/action-plan.ts';
import type { CanonicalStatusView } from '../../src/lib/status/types.ts';
import type { MediaReferencesStatus } from '../../src/lib/status/media-reference-types.ts';
import { inquirerTheme, useCliColor } from '../db/operator-cli-ux.ts';
import {
	buildMediaOperationalPlan,
	formatMediaReferences,
	readMediaReferencesStatus,
} from './dbs-media-references.ts';
import { formatCanonicalStatusView } from './canonical-status-format.ts';
import { buildInvitationChoices } from './dbs-interactive-model.ts';
import { formatInvitationDetail } from './dbs-interactive-format.ts';

type InteractiveState = {
	view: CanonicalStatusView;
	media: MediaReferencesStatus;
	plan: OperationalActionPlan;
};

function color(code: number, value: string, env: NodeJS.ProcessEnv = process.env): string {
	return useCliColor(env) ? `\x1b[${code}m${value}\x1b[0m` : value;
}

async function loadState(): Promise<InteractiveState> {
	const { buildCanonicalStatusView, refineCanonicalStatusViewPromotions } =
		await import('./canonical-status.ts');
	const fast = await buildCanonicalStatusView({ includeProductionPreflight: false });
	let view = fast;
	try {
		view = await refineCanonicalStatusViewPromotions(fast);
	} catch {
		// Keep the read-only base view; its existing evidence markers remain visible.
	}
	const media = readMediaReferencesStatus();
	return {
		view,
		media,
		plan: buildMediaOperationalPlan(buildOperationalActionPlan(view), media),
	};
}

async function showInvitations(state: InteractiveState): Promise<void> {
	const choices = buildInvitationChoices(state.view, state.media);
	for (const target of ['preview', 'production'] as const)
		if (state.media[target]?.status === 'UNVERIFIED')
			console.log(
				color(33, `${target}: sin verificar; podrían faltar invitaciones pendientes.`),
			);
	if (choices.length === 0) {
		console.log('No hay actualizaciones confirmadas para seleccionar.');
		return;
	}
	const selection = await search<string>({
		message: 'Buscar invitación pendiente por slug',
		source: (term) => {
			const query = (term ?? '').toLocaleLowerCase();
			return [
				...choices
					.filter((choice) => choice.label.includes(query))
					.slice(0, 30)
					.map((choice) => ({ name: choice.label, value: choice.route })),
				{ name: '← Volver', value: 'back' },
			];
		},
		pageSize: 12,
		theme: inquirerTheme(),
	});
	if (selection === 'back') return;
	const choice = choices.find((item) => item.route === selection);
	if (choice) console.log(formatInvitationDetail({ choice, ...state }));
}

export async function runDbsInteractive(): Promise<void> {
	let state: InteractiveState | null = null;
	try {
		while (true) {
			const selected = await select<'status' | 'invitations' | 'exit'>({
				message: 'Celebra-me · Estado de entornos',
				choices: [
					{ name: 'Estado general', value: 'status' },
					{ name: 'Invitaciones', value: 'invitations' },
					{ name: 'Salir', value: 'exit' },
				],
				theme: inquirerTheme(),
			});
			if (selected === 'exit') return;
			state ??= await loadState();
			if (selected === 'status') {
				console.log(formatCanonicalStatusView(state.view, { operationalPlan: state.plan }));
				console.log(`Estado operativo: ${state.plan.health.status}`);
				console.log(formatMediaReferences(state.media));
			} else await showInvitations(state);
		}
	} catch (error) {
		if (error instanceof Error && error.name === 'ExitPromptError') return;
		throw error;
	}
}
