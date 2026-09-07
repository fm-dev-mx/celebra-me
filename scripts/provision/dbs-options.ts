import type { TargetEnv } from './dbs-status.ts';

/** Parse target scope before any environment or credential lookup. */
export function readStatusTargets(args: readonly string[]): {
	args: string[];
	targets?: TargetEnv[];
} {
	const remaining: string[] = [];
	let targets: TargetEnv[] | undefined;
	const allowed = ['local', 'preview', 'production'] as const;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg !== '--targets' && !arg.startsWith('--targets=')) {
			remaining.push(arg);
			continue;
		}
		if (targets) throw new Error('--targets may only be specified once.');
		const values: string[] = [];
		if (arg.startsWith('--targets=')) values.push(arg.slice('--targets='.length));
		else while (i + 1 < args.length && !args[i + 1].startsWith('--')) values.push(args[++i]);
		const tokens = values
			.join(' ')
			.split(/[\s,]+/)
			.filter(Boolean);
		if (!tokens.length || tokens.some((value) => !allowed.some((target) => target === value))) {
			throw new Error(
				'--targets requires local, preview, or production (comma or space separated).',
			);
		}
		targets = allowed.filter((target) => tokens.includes(target));
	}
	return { args: remaining, targets };
}

/** Excluded environment entries are explicitly unevaluated, never zero or healthy. */
export function statusScopeJson(value: object, targets?: readonly TargetEnv[]): string {
	const excludedTargets = targets
		? (['local', 'preview', 'production'] as const).filter((env) => !targets.includes(env))
		: [];
	return JSON.stringify(
		targets ? { ...value, selectedTargets: targets, excludedTargets } : value,
		(key, entry) => (excludedTargets.some((env) => env === key) ? null : entry),
		2,
	);
}
