import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	detectFileMimeType,
	normalizeInvitationImage,
	ROLE_AWARE_ASSET_POLICY_VERSION,
} from '@/lib/intake/services/asset-policy';
import {
	getImageOptimizationRoleForPath,
	getWeightTargetBytes,
	type ImageOptimizationRole,
} from '@/lib/invitation-preparation/image-optimization';
import { collectUploadedContentRefs } from '@/lib/invitation-preparation/uploaded-content-refs';
import {
	ASSET_KEY_PREFIX,
	buildSemanticAssetMap,
} from '../../scripts/provision/normalized-invitation-release.ts';
import {
	getInvitationAssetSourceDir,
	type InvitationAssetSpec,
} from '../../scripts/provision/invitations/invitation-definition.ts';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';

function specKeyFromAssetId(assetId: string): string {
	expect(assetId.startsWith(ASSET_KEY_PREFIX)).toBe(true);
	return assetId.slice(ASSET_KEY_PREFIX.length);
}

function pathRolesBySpecKey(
	content: Record<string, unknown>,
): Map<string, Set<ImageOptimizationRole>> {
	const rolesByKey = new Map<string, Set<ImageOptimizationRole>>();
	for (const ref of collectUploadedContentRefs(content)) {
		// Social OG intentionally reuses an existing managed asset; it is not a
		// separate delivery-role binding for compression budgets.
		if (ref.path === 'sharing.ogImage') continue;
		const key = specKeyFromAssetId(ref.assetId);
		const roles = rolesByKey.get(key) ?? new Set<ImageOptimizationRole>();
		roles.add(getImageOptimizationRoleForPath(ref.path));
		rolesByKey.set(key, roles);
	}
	return rolesByKey;
}

describe('published asset path-role budget contract', () => {
	const definitions = listInvitationDefinitions();

	it('registers managed invitations to audit', () => {
		expect(definitions.length).toBeGreaterThan(0);
	});

	it.each(definitions.map((definition) => [definition.slug, definition] as const))(
		'%s does not bind one asset key to multiple delivery roles',
		(_slug, definition) => {
			const content = definition.buildPublishedContent(buildSemanticAssetMap(definition));
			for (const [key, roles] of pathRolesBySpecKey(content)) {
				expect({ key, roleCount: roles.size }).toEqual({ key, roleCount: 1 });
			}
		},
	);

	it.each(definitions.map((definition) => [definition.slug, definition] as const))(
		'%s keeps declared assets within spec and path-role budgets',
		async (_slug, definition) => {
			const content = definition.buildPublishedContent(buildSemanticAssetMap(definition));
			const rolesByKey = pathRolesBySpecKey(content);
			const assetDir = join(process.cwd(), getInvitationAssetSourceDir(definition));
			const specs = definition.assets as readonly InvitationAssetSpec[];

			for (const spec of specs) {
				const filePath = join(assetDir, spec.relativePath);
				expect(existsSync(filePath)).toBe(true);
				const sourceBytes = readFileSync(filePath);
				const declaredMime = detectFileMimeType(spec.relativePath, sourceBytes);
				const normalized = await normalizeInvitationImage(
					new Blob([sourceBytes], { type: declaredMime }),
					declaredMime,
					spec.optimizationRole,
				);
				const { fileSize, validationVersion } = normalized;

				if (spec.optimizationRole) {
					expect(fileSize).toBeLessThanOrEqual(
						getWeightTargetBytes(spec.optimizationRole),
					);
				}

				for (const role of rolesByKey.get(spec.key) ?? []) {
					if (validationVersion < ROLE_AWARE_ASSET_POLICY_VERSION) continue;
					const maxBytes = getWeightTargetBytes(role);
					if (fileSize > maxBytes) {
						throw new Error(
							`${definition.slug} asset "${spec.key}" is ${fileSize} bytes on ${role} (max ${maxBytes}).`,
						);
					}
				}
			}
		},
		30_000,
	);
});
