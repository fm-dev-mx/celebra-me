/**
 * Interactive field/section selection for selective invitation:release apply.
 */
import { checkbox, select } from '@inquirer/prompts';
import type { ConflictResolutions } from './semantic-delta.ts';
import type { FunctionalChange } from './invitation-update-plan.ts';
import {
	buildPathPolicyFromSelection,
	collectSelectableFieldPaths,
	collectSelectableSectionRoots,
	fieldPathRoot,
} from './conflict-resolutions.ts';
import {
	formatFunctionalChangesSummary,
	type OperationalPlanData,
} from './invitation-update-presenter.ts';

type FieldSelectionMode = 'all' | 'sections' | 'fields';

function sectionLabelForRoot(
	root: string,
	changes: FunctionalChange[] | undefined,
): string {
	const match = changes?.find((change) => change.field && fieldPathRoot(change.field) === root);
	return match?.section ?? root;
}

/**
 * Prompt the operator to apply all planned content changes, or a subset by
 * section / field. Returns undefined when applying all (no path policy needed).
 */
export async function promptFieldSelection(input: {
	plan: OperationalPlanData;
}): Promise<ConflictResolutions | undefined> {
	const changes = input.plan.functionalChanges ?? [];
	const fieldPaths = collectSelectableFieldPaths(changes);
	if (fieldPaths.length === 0) return undefined;

	console.log('');
	console.log(formatFunctionalChangesSummary(changes).join('\n'));

	const mode = await select<FieldSelectionMode>({
		message: '¿Qué cambios de contenido deseas aplicar?',
		choices: [
			{ name: 'Todos los cambios del paquete', value: 'all' },
			{ name: 'Elegir por sección', value: 'sections' },
			{ name: 'Elegir campo a campo', value: 'fields' },
		],
	});

	if (mode === 'all') return undefined;

	if (mode === 'sections') {
		const roots = collectSelectableSectionRoots(changes);
		const selectedRoots = await checkbox({
			message: 'Secciones a aplicar (desmarca para conservar el destino)',
			choices: roots.map((root) => ({
				name: `${sectionLabelForRoot(root, changes)} (${root})`,
				value: root,
				checked: true,
			})),
			required: false,
		});
		return buildPathPolicyFromSelection({
			availablePaths: roots,
			selectedPaths: selectedRoots,
		});
	}

	const selectedPaths = await checkbox({
		message: 'Campos a aplicar (desmarca para conservar el destino)',
		choices: fieldPaths.map((path) => {
			const change = changes.find((candidate) => candidate.field === path);
			const label = change
				? `${change.section} — ${change.entity} (${path})`
				: path;
			return { name: label, value: path, checked: true };
		}),
		required: false,
	});

	return buildPathPolicyFromSelection({
		availablePaths: fieldPaths,
		selectedPaths,
	});
}
