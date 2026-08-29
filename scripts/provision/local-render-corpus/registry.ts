/**
 * Local Render Corpus projection.
 *
 * Invitation definitions are the only invitation inventory. This module only
 * derives the renderable corpus used by regression tooling; it is not a second
 * source registry and has no legacy classification.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getInvitationAssetSourceDir } from '../invitations/invitation-definition.ts';
import {
	getInvitationDefinition,
	listInvitationDefinitions,
} from '../invitations/registry.ts';

export type CorpusClassification = 'canonical';
export type CorpusSourceStrategy = 'canonical_definition';
export type CorpusAssetStrategy = 'VERSIONED_MANAGED_ASSET' | 'VERSIONED_LOCAL_ASSET';

export interface LocalRenderCorpusEntry {
	readonly slug: string;
	readonly eventType: string;
	readonly classification: CorpusClassification;
	readonly remoteParity: 'required';
	readonly sourceStrategy: CorpusSourceStrategy;
	readonly assetStrategy: CorpusAssetStrategy;
	readonly assetStatus: 'ready' | 'missing';
	readonly themeId: string;
	readonly visualProfileId: string;
	readonly sourceDefinition: string;
}

function assetReadiness(definition: ReturnType<typeof getInvitationDefinition>): 'ready' | 'missing' {
	const root = getInvitationAssetSourceDir(definition);
	return existsSync(root) && definition.assets.every((asset) => existsSync(join(root, asset.relativePath)))
		? 'ready'
		: 'missing';
}

function assetStrategyFor(slug: string): CorpusAssetStrategy {
	const definition = getInvitationDefinition(slug);
	return existsSync(getInvitationAssetSourceDir(definition))
		? 'VERSIONED_MANAGED_ASSET'
		: 'VERSIONED_LOCAL_ASSET';
}

function deriveEntry(definition: ReturnType<typeof getInvitationDefinition>): LocalRenderCorpusEntry {
	return {
		slug: definition.slug,
		eventType: definition.eventType,
		classification: 'canonical',
		remoteParity: 'required',
		sourceStrategy: 'canonical_definition',
		assetStrategy: assetStrategyFor(definition.slug),
		assetStatus: assetReadiness(definition),
		themeId: definition.themeId,
		visualProfileId: definition.visualProfileId,
		sourceDefinition: `scripts/provision/invitations/${definition.slug}.ts`,
	};
}

export const EXPECTED_LOCAL_RENDER_CORPUS_SIZE = 17;

export const LOCAL_RENDER_CORPUS: readonly LocalRenderCorpusEntry[] =
	listInvitationDefinitions().map(deriveEntry);

export function listLocalRenderCorpus(): readonly LocalRenderCorpusEntry[] {
	return LOCAL_RENDER_CORPUS;
}

export function corpusPublicRoute(entry: LocalRenderCorpusEntry): string {
	return `/${entry.eventType}/${entry.slug}`;
}

export function assertLocalRenderCorpusIntegrity(): void {
	if (LOCAL_RENDER_CORPUS.length !== EXPECTED_LOCAL_RENDER_CORPUS_SIZE) {
		throw new Error(
			`Local Render Corpus must contain exactly ${EXPECTED_LOCAL_RENDER_CORPUS_SIZE} managed canonical invitations (found ${LOCAL_RENDER_CORPUS.length}).`,
		);
	}
	const definitions = new Map(listInvitationDefinitions().map((definition) => [definition.slug, definition]));
	const slugs = new Set<string>();
	const routes = new Set<string>();
	for (const entry of LOCAL_RENDER_CORPUS) {
		if (slugs.has(entry.slug)) throw new Error(`Duplicate Local Render Corpus slug: ${entry.slug}`);
		slugs.add(entry.slug);
		const definition = definitions.get(entry.slug);
		if (!definition) {
			throw new Error(`Corpus entry ${entry.slug} has no canonical definition.`);
		}
		if (entry.sourceStrategy !== 'canonical_definition' || entry.classification !== 'canonical') {
			throw new Error(`Corpus entry ${entry.slug} is not canonical-definition backed.`);
		}
		if (entry.sourceDefinition !== `scripts/provision/invitations/${entry.slug}.ts`) {
			throw new Error(`Corpus entry ${entry.slug} has an invalid source definition path.`);
		}
		const route = corpusPublicRoute(entry).toLowerCase();
		if (routes.has(route)) throw new Error(`Duplicate Local Render Corpus route: ${route}`);
		routes.add(route);
		if (entry.slug.startsWith('demo-') || entry.slug === 'e2e-preview-publication') {
			throw new Error(`Excluded slug incorrectly registered in Local Render Corpus: ${entry.slug}`);
		}
		if (entry.themeId !== definition.themeId || entry.visualProfileId !== definition.visualProfileId) {
			throw new Error(`Corpus metadata drift for ${entry.slug}.`);
		}
		const expectedAssetStatus = assetReadiness(definition);
		if (entry.assetStatus !== expectedAssetStatus) {
			throw new Error(`Corpus asset readiness drift for ${entry.slug}.`);
		}
	}
	const definitionsList = listInvitationDefinitions();
	if (definitionsList.length !== slugs.size || definitionsList.some((definition) => !slugs.has(definition.slug))) {
		throw new Error('Invitation registry and Local Render Corpus are out of sync.');
	}
}

assertLocalRenderCorpusIntegrity();
