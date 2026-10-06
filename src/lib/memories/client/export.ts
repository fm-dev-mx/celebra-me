/**
 * Organizer export: ZIP batches built in the browser. Encryption is the default;
 * its passphrase is generated with Web Crypto and never leaves the device.
 */

import {
	MEMORIES_ARCHIVE_MAX_BYTES,
	MEMORIES_ARCHIVE_MAX_FILES,
} from '@/lib/memories/contract/limits';
import {
	MEMORIES_RECOVERY_CODE_ALPHABET,
	formatMemoriesCodeGroups,
} from '@/lib/memories/contract/catalog';
import { getMemoriesMimePolicy } from '@/lib/memories/contract/media-policy';

const PASSPHRASE_GROUPS = 4;

export type ExportableMediaItem = {
	id: string;
	mimeType: string;
	sizeBytes: number;
	caption?: string;
	createdAt: string;
};

export type BulkExportProgress = {
	completed: number;
	total: number;
	currentFileName: string;
};

export function generateBulkZipPassphrase(): string {
	if (!globalThis.crypto?.getRandomValues) throw new Error('Web Crypto no está disponible.');
	const bytes = new Uint8Array(PASSPHRASE_GROUPS * 4);
	globalThis.crypto.getRandomValues(bytes);
	const raw = Array.from(
		bytes,
		(byte) => MEMORIES_RECOVERY_CODE_ALPHABET[byte % MEMORIES_RECOVERY_CODE_ALPHABET.length],
	).join('');
	return formatMemoriesCodeGroups(raw, PASSPHRASE_GROUPS);
}

export function partitionMemoriesExport<T extends ExportableMediaItem>(items: T[]): T[][] {
	const batches: T[][] = [];
	let current: T[] = [];
	let currentBytes = 0;
	for (const item of items) {
		if (item.sizeBytes > MEMORIES_ARCHIVE_MAX_BYTES) {
			throw new Error('Un archivo individual supera el límite del lote cifrado.');
		}
		if (
			current.length >= MEMORIES_ARCHIVE_MAX_FILES ||
			currentBytes + item.sizeBytes > MEMORIES_ARCHIVE_MAX_BYTES
		) {
			if (current.length > 0) batches.push(current);
			current = [];
			currentBytes = 0;
		}
		current.push(item);
		currentBytes += item.sizeBytes;
	}
	if (current.length > 0) batches.push(current);
	return batches;
}

/** Builds one ZIP batch; a null passphrase produces an unencrypted archive. */
export async function createMemoriesZip(input: {
	folderName: string;
	items: ExportableMediaItem[];
	passphrase: string | null;
	fetchItemBlob: (item: ExportableMediaItem) => Promise<Blob>;
	onProgress?: (progress: BulkExportProgress) => void;
}): Promise<Blob> {
	const { BlobReader, BlobWriter, ZipWriter } = await import('@zip.js/zip.js');
	if (input.items.length === 0) throw new Error('No hay archivos para exportar.');
	if (input.items.length > MEMORIES_ARCHIVE_MAX_FILES) {
		throw new Error(
			`El lote supera el límite de ${MEMORIES_ARCHIVE_MAX_FILES} archivos por descarga masiva.`,
		);
	}
	const totalBytes = input.items.reduce((total, item) => total + item.sizeBytes, 0);
	if (totalBytes > MEMORIES_ARCHIVE_MAX_BYTES) {
		throw new Error(
			`El lote supera el límite de ${MEMORIES_ARCHIVE_MAX_BYTES / 1024 / 1024} MiB por descarga masiva.`,
		);
	}
	const encryption = input.passphrase
		? { password: input.passphrase, encryptionStrength: 3 as const }
		: {};
	const zipWriter = new ZipWriter(new BlobWriter('application/zip'), {
		...encryption,
		zip64: false,
	});
	try {
		for (let index = 0; index < input.items.length; index += 1) {
			const item = input.items[index];
			const extension = getMemoriesMimePolicy(item.mimeType)?.extension ?? 'bin';
			const filename = `${input.folderName}/${item.createdAt.slice(0, 10)}-${item.id.slice(0, 8)}.${extension}`;
			input.onProgress?.({
				completed: index,
				total: input.items.length,
				currentFileName: filename,
			});
			const blob = await input.fetchItemBlob(item);
			await zipWriter.add(filename, new BlobReader(blob), encryption);
		}
		input.onProgress?.({
			completed: input.items.length,
			total: input.items.length,
			currentFileName: 'Completado',
		});
		return await zipWriter.close();
	} catch (error) {
		await zipWriter.close().catch(() => undefined);
		throw error;
	}
}
