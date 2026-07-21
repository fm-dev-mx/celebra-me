/**
 * preview-sync-storage.ts — Storage Binary Synchronization
 *
 * Fetches asset binaries from Production Storage and uploads to Preview,
 * reporting missing or failed assets.
 */

export interface AssetToSync {
	id: string;
	storagePath: string;
	bucket: string;
}

export interface StorageReport {
	copiedAssets: number;
	missingAssets: string[];
}

async function fetchStorageObject(storageUrl: string, path: string): Promise<ArrayBuffer | null> {
	try {
		const response = await fetch(`${storageUrl}/${path}`);
		if (!response.ok) return null;
		return response.arrayBuffer();
	} catch {
		return null;
	}
}

async function uploadStorageObject(
	supabaseUrl: string,
	serviceRoleKey: string,
	bucket: string,
	path: string,
	data: ArrayBuffer,
): Promise<boolean> {
	try {
		const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${serviceRoleKey}`,
				'Content-Type': 'application/octet-stream',
				'x-upsert': 'true',
			},
			body: data,
		});
		return response.ok;
	} catch {
		return false;
	}
}

export async function syncAsset(
	asset: AssetToSync,
	prodStorageUrl: string,
	previewSupabaseUrl: string,
	previewServiceRoleKey: string,
	dryRun: boolean,
	report: StorageReport,
): Promise<boolean> {
	if (dryRun) {
		console.info(`   [dry-run] Would copy asset: ${asset.storagePath}`);
		return true;
	}

	console.info(`   Fetching asset: ${asset.storagePath}`);
	const data = await fetchStorageObject(prodStorageUrl, asset.storagePath);
	if (!data) {
		report.missingAssets.push(asset.storagePath);
		console.warn(`   ⚠️  Asset not found in Production: ${asset.storagePath}`);
		return false;
	}

	console.info(`   Uploading to Preview: ${asset.storagePath} (${data.byteLength} bytes)`);
	const uploaded = await uploadStorageObject(
		previewSupabaseUrl,
		previewServiceRoleKey,
		asset.bucket || 'invitation-assets',
		asset.storagePath,
		data,
	);

	if (uploaded) {
		report.copiedAssets++;
		console.info(`   ✅ Asset uploaded: ${asset.storagePath}`);
		return true;
	}

	console.warn(`   ❌ Upload failed: ${asset.storagePath}`);
	return false;
}
