/**
 * Local-only bootstrap for the Local Render Corpus.
 *
 * The corpus is derived from managed invitation definitions. Every entry uses
 * the same guarded invitation release pipeline; there is no fixture-only path.
 */
import { classifyDbTarget } from '../../db/db-guard.ts';
import { applyLocalInvitation } from '../apply-local-invitation.ts';
import { resolveLocalEnv } from '../local-provision-env.ts';
import {
	assertLocalRenderCorpusIntegrity,
	listLocalRenderCorpus,
	type LocalRenderCorpusEntry,
} from './registry.ts';

export type CorpusBootstrapMode = 'dry-run' | 'apply';

export interface CorpusBootstrapEntryResult {
	slug: string;
	classification: LocalRenderCorpusEntry['classification'];
	action: 'planned' | 'applied' | 'unchanged';
	detail: string;
}

export interface CorpusBootstrapResult {
	mode: CorpusBootstrapMode;
	target: 'persistent-local';
	entries: CorpusBootstrapEntryResult[];
}

function assertLocalOnly(dbUrl: string): void {
	const classification = classifyDbTarget(dbUrl);
	if (classification.target !== 'persistent-local') {
		throw new Error(
			`LOCAL_RENDER_CORPUS_TARGET_REJECTED: bootstrap may only target persistent-local (got ${classification.target}).`,
		);
	}
}

async function bootstrapCanonical(
	entry: LocalRenderCorpusEntry,
	apply: boolean,
): Promise<CorpusBootstrapEntryResult> {
	const result = await applyLocalInvitation({
		slug: entry.slug,
		apply,
		updateScope: 'content-and-assets',
		assetPolicy: 'missing',
	});
	const detail = apply
		? `canonical Local apply invitationId=${result.invitationId} zeroDrift=${result.isZeroDrift} ops=${result.completedOperations}`
		: `canonical Local dry-run invitationId=${result.invitationId} plannedOps=${result.plannedOperations}`;
	return {
		slug: entry.slug,
		classification: 'canonical',
		action: apply
			? result.isZeroDrift && result.completedOperations === 0
				? 'unchanged'
				: 'applied'
			: 'planned',
		detail,
	};
}

export async function bootstrapLocalRenderCorpus(options: {
	mode: CorpusBootstrapMode;
	slugs?: readonly string[];
}): Promise<CorpusBootstrapResult> {
	assertLocalRenderCorpusIntegrity();
	const env = resolveLocalEnv();
	assertLocalOnly(env.dbUrl);

	const wanted = options.slugs
		? listLocalRenderCorpus().filter((entry) => options.slugs!.includes(entry.slug))
		: [...listLocalRenderCorpus()];
	if (options.slugs) {
		for (const slug of options.slugs) {
			if (!wanted.some((entry) => entry.slug === slug)) {
				throw new Error(`Unknown Local Render Corpus slug: ${slug}`);
			}
		}
	}

	const apply = options.mode === 'apply';
	const entries: CorpusBootstrapEntryResult[] = [];
	for (const entry of wanted) entries.push(await bootstrapCanonical(entry, apply));
	return { mode: options.mode, target: 'persistent-local', entries };
}
