/** Approval artifacts bind to package storage paths, not leftover Cloudinary public IDs. */

export function selectPackageApprovalAssetHashes(
	hashes: Record<string, string>,
	packageAssets: readonly { storagePath: string }[],
): Record<string, string> {
	const allowed = new Set(packageAssets.map((asset) => asset.storagePath));
	const selected: Record<string, string> = {};
	for (const [path, hash] of Object.entries(hashes)) {
		if (allowed.has(path)) selected[path] = hash;
	}
	return selected;
}

/** Keys the approval must re-check: verified live paths plus package managed/ paths. */
export function selectEnforcedApprovalAssetPaths(
	expectedAssetHashes: Record<string, string>,
	verifiedHashes: Record<string, string>,
): string[] {
	return Object.keys(expectedAssetHashes).filter(
		(path) => path in verifiedHashes || path.startsWith('managed/'),
	);
}
