import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectFileMimeType, normalizeInvitationImage } from '@/lib/intake/services/asset-policy';
import {
	getInvitationAssetSourceDir,
	type InvitationAssetSpec,
	type InvitationDefinition,
} from '../../scripts/provision/invitations/invitation-definition.ts';
import {
	assertManifestMatchesDefinition,
	readInvitationMediaManifest,
	type InvitationMediaManifestEntry,
} from '../../scripts/provision/invitation-media-manifest.ts';

export type NormalizedAssetFacts = Pick<
	InvitationMediaManifestEntry,
	'fileSize' | 'validationVersion' | 'mimeType' | 'width' | 'height'
>;

export function invitationAssetRoot(definition: InvitationDefinition): string {
	return join(process.cwd(), getInvitationAssetSourceDir(definition));
}

/** Manifest entries of a frozen invitation, keyed by asset key; null when it ships source files. */
export function invitationMediaEntries(
	definition: InvitationDefinition,
): Map<string, InvitationMediaManifestEntry> | null {
	const manifest = readInvitationMediaManifest(invitationAssetRoot(definition));
	return manifest ? assertManifestMatchesDefinition(manifest, definition) : null;
}

/** Each declared asset is backed by a manifest entry or by a source file. */
export function hasDeclaredAssetSource(
	definition: InvitationDefinition,
	spec: Pick<InvitationAssetSpec, 'key' | 'relativePath'>,
): boolean {
	const entries = invitationMediaEntries(definition);
	if (entries) return entries.get(spec.key)?.relativePath === spec.relativePath;
	return existsSync(join(invitationAssetRoot(definition), spec.relativePath));
}

/** Delivered (normalized) facts: from the manifest when frozen, else by normalizing the source. */
export async function normalizedAssetFacts(
	definition: InvitationDefinition,
	spec: InvitationAssetSpec,
): Promise<NormalizedAssetFacts> {
	const entry = invitationMediaEntries(definition)?.get(spec.key);
	if (entry) return entry;
	const sourceBytes = readFileSync(join(invitationAssetRoot(definition), spec.relativePath));
	const declaredMime = detectFileMimeType(spec.relativePath, sourceBytes);
	return normalizeInvitationImage(
		new Blob([sourceBytes], { type: declaredMime }),
		declaredMime,
		spec.optimizationRole,
	);
}

/** Asset paths a frozen invitation's media manifest records. */
export function invitationMediaPaths(definition: InvitationDefinition): Set<string> {
	return new Set(
		[...(invitationMediaEntries(definition)?.values() ?? [])].map(
			(entry) => entry.relativePath,
		),
	);
}
