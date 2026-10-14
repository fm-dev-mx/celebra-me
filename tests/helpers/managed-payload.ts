/**
 * Managed invitation payload fixtures: deterministic uploaded-asset refs for a definition's asset
 * specs, the published projection of a registered definition, and string scans over a payload.
 */
import type { UploadedAssetMap } from '../../scripts/provision/invitations/invitation-definition.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

/** Authoring leftovers and admin copy that must never reach a published payload. */
const PLACEHOLDER_PATTERN =
	/PENDIENTE|\[confirmar|Confirmar ubicación|definir fecha límite|confirmar número de registro|Solicitar enlace de Google Maps|(?:^|: )Por confirmar$|Pendiente de confirmar/i;

/** One Local Storage upload ref per asset spec, with stable UUIDs in spec order. */
export function buildTestAssets<K extends string>(
	specs: readonly { readonly key: K }[],
): UploadedAssetMap<K> {
	return Object.fromEntries(
		specs.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as UploadedAssetMap<K>;
}

/** Published content of a registered definition, built through its delivery-aware wrapper. */
export function buildManagedPublishedContent(slug: string): Record<string, unknown> {
	const definition = getInvitationDefinition(slug);
	return definition.buildPublishedContent(buildTestAssets(definition.assets));
}

function collectStringPairs(value: unknown, pathSegments: string[] = []): Array<[string, string]> {
	if (typeof value === 'string') return [[pathSegments.join('.'), value]];
	if (Array.isArray(value)) {
		return value.flatMap((item, index) =>
			collectStringPairs(item, [...pathSegments, String(index)]),
		);
	}
	if (value && typeof value === 'object') {
		return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
			collectStringPairs(item, [...pathSegments, key]),
		);
	}
	return [];
}

/** Every string in a payload as `dotted.path: value`. */
export function collectStringEntries(value: unknown): string[] {
	return collectStringPairs(value).map(([entryPath, text]) => `${entryPath}: ${text}`);
}

/** Strings matching a placeholder or admin-copy pattern, as `dotted.path: value`. */
export function collectPlaceholderStrings(value: unknown): string[] {
	return collectStringPairs(value)
		.filter(([, text]) => PLACEHOLDER_PATTERN.test(text))
		.map(([entryPath, text]) => `${entryPath}: ${text}`);
}
