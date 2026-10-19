import {
	R2StorageProvider,
	getStorageProvider,
} from '../../src/lib/intake/services/storage-provider';
import {
	installInvitationMediaBinding,
	putR2InvitationMedia,
	resetInvitationMediaBindingForTests,
	type InvitationMediaBucket,
} from '../../src/lib/intake/services/r2-invitation-media';
import { resolveAssetDeliveryUrl } from '../../src/lib/intake/services/asset-delivery';
import { RESPONSIVE_IMAGE_WIDTHS } from '../../src/lib/images/responsive-variants';

function memoryBucket(): InvitationMediaBucket & { objects: Map<string, Record<string, string>> } {
	const objects = new Map<string, Record<string, string>>();
	return {
		objects,
		async head(key) {
			const metadata = objects.get(key);
			return metadata ? { size: 1, customMetadata: metadata } : null;
		},
		async put(key, _value, options) {
			objects.set(key, options.customMetadata);
		},
	};
}

const sha256 = 'c'.repeat(64);
const upload = {
	invitationId: '00000000-0000-4000-8000-000000000001',
	eventType: 'boda',
	slug: 'ana-y-luis',
	key: 'hero',
	displayName: 'Hero',
	blob: new Blob([new Uint8Array([1, 2, 3])]),
	mimeType: 'image/webp',
	width: 10,
	height: 10,
	fileSize: 3,
	validationVersion: 1,
	originalMimeType: 'image/jpeg',
	originalFileSize: 3,
	sha256,
};

async function fakeVariants() {
	return RESPONSIVE_IMAGE_WIDTHS.map((width) => ({ width, data: new Uint8Array([width % 256]) }));
}

afterEach(() => resetInvitationMediaBindingForTests());

describe('R2 invitation media storage', () => {
	it('stores a content-addressed object and returns its public URL', async () => {
		const bucket = memoryBucket();
		const result = await new R2StorageProvider('production', bucket, fakeVariants).uploadAsset(
			upload,
		);
		const key = `invitations/boda/ana-y-luis/hero-${sha256}.webp`;
		expect(result).toMatchObject({
			provider: 'r2',
			bucket: 'celebra-me-invitation-media',
			storagePath: key,
			providerPublicId: key,
			secureUrl: `https://media.celebra-me.com/${key}`,
		});
		expect(bucket.objects.get(key)).toEqual({ sha256 });
		expect(
			resolveAssetDeliveryUrl({
				provider: 'r2',
				bucket: '',
				storagePath: key,
				secureUrl: result.secureUrl,
			}),
		).toBe(result.secureUrl);
	});

	it('writes every width variant beside the original and skips the encoder once stored', async () => {
		const bucket = memoryBucket();
		const encode = jest.fn(fakeVariants);
		const provider = new R2StorageProvider('preview', bucket, encode);
		await provider.uploadAsset(upload);
		const base = `invitations/boda/ana-y-luis/hero-${sha256}`;
		for (const width of RESPONSIVE_IMAGE_WIDTHS)
			expect(bucket.objects.get(`${base}.w${width}.webp`)).toEqual({ source_sha256: sha256 });
		await provider.uploadAsset(upload);
		expect(encode).toHaveBeenCalledTimes(1);
	});

	it('writes no variants for audio', async () => {
		const bucket = memoryBucket();
		const encode = jest.fn(fakeVariants);
		await new R2StorageProvider('preview', bucket, encode).uploadAsset({
			...upload,
			key: 'song',
			mimeType: 'audio/mpeg',
		});
		expect(encode).not.toHaveBeenCalled();
		expect([...bucket.objects.keys()]).toEqual([
			`invitations/boda/ana-y-luis/song-${sha256}.mp3`,
		]);
	});

	it('reuses identical bytes and refuses to overwrite different bytes', async () => {
		const bucket = memoryBucket();
		const input = {
			target: 'preview' as const,
			objectKey: 'invitations/xv/a/hero.webp',
			bytes: new Uint8Array(),
			mimeType: 'image/webp',
			sha256,
		};
		await putR2InvitationMedia(bucket, input);
		await expect(putR2InvitationMedia(bucket, input)).resolves.toMatchObject({ reused: true });
		await expect(
			putR2InvitationMedia(bucket, { ...input, sha256: 'd'.repeat(64) }),
		).rejects.toThrow('different bytes');
	});

	it('reuses an object the migration copied without digest metadata', async () => {
		const bucket = memoryBucket();
		const objectKey = `invitations/xv/a/hero-${sha256}.webp`;
		bucket.objects.set(objectKey, {});
		await expect(
			putR2InvitationMedia(bucket, {
				target: 'preview',
				objectKey,
				bytes: new Uint8Array(),
				mimeType: 'image/webp',
				sha256,
			}),
		).resolves.toMatchObject({ reused: true });
	});

	it('selects R2 only when the Worker installed the binding', () => {
		expect(() => getStorageProvider('production')).toThrow('INVITATION_MEDIA R2 binding');
		expect(() => getStorageProvider('preview')).toThrow('INVITATION_MEDIA R2 binding');
		expect(installInvitationMediaBinding({ INVITATION_MEDIA: memoryBucket() })).toBe(true);
		expect(getStorageProvider('production').providerName).toBe('r2');
		expect(getStorageProvider('local').providerName).toBe('supabase');
	});

	it('requires secure_url for R2 delivery', () => {
		expect(() =>
			resolveAssetDeliveryUrl({ provider: 'r2', bucket: 'b', storagePath: 'k' }),
		).toThrow('R2 asset is missing secure_url');
	});
});
