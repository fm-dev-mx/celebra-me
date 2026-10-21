import { describe, expect, it } from '@jest/globals';
import { isRoleAwareAssetPolicy } from '@/lib/intake/services/asset-policy';
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
import type { InvitationAssetSpec } from '../../scripts/provision/invitations/invitation-definition.ts';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import { hasDeclaredAssetSource, normalizedAssetFacts } from '../helpers/invitation-media';

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
			const specs = definition.assets as readonly InvitationAssetSpec[];

			for (const spec of specs) {
				expect(hasDeclaredAssetSource(definition, spec)).toBe(true);
				const { fileSize, validationVersion } = await normalizedAssetFacts(
					definition,
					spec,
				);

				if (spec.optimizationRole) {
					expect(fileSize).toBeLessThanOrEqual(
						getWeightTargetBytes(spec.optimizationRole),
					);
				}

				for (const role of rolesByKey.get(spec.key) ?? []) {
					if (!isRoleAwareAssetPolicy(validationVersion)) continue;
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
