import { describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import {
	CloudinaryApiError,
	buildCloudinarySignatureString,
	buildCloudinaryUploadForm,
	createCloudinaryRestClient,
	signCloudinaryParams,
} from '@/lib/intake/services/cloudinary-rest';

const config = { cloudName: 'demo cloud', apiKey: 'key-123', apiSecret: 'abcd' };

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init,
	});
}

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
	return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
		handler(String(input), init),
	) as unknown as jest.MockedFunction<typeof fetch>;
}

describe('cloudinary REST signature', () => {
	it('matches the documented Cloudinary example (sorted, SHA-1, secret appended)', () => {
		// https://cloudinary.com/documentation/authentication_signatures: expected signature for
		// eager + public_id + timestamp with secret "abcd".
		const params = {
			eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
			public_id: 'sample_image',
			timestamp: 1315060510,
			api_key: 'ignored',
			file: 'ignored',
		};
		expect(buildCloudinarySignatureString(params)).toBe(
			'eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510',
		);
		expect(signCloudinaryParams(params, 'abcd')).toBe(
			'bfd09f95f331f558cbd1320e67aa8d488770583e',
		);
	});

	it('renders values the way the SDK does: booleans as 1/0, arrays joined, blanks dropped', () => {
		expect(
			buildCloudinarySignatureString({
				tags: ['managed-invitation', 'slug'],
				overwrite: false,
				unique_filename: true,
				asset_folder: '',
				context: undefined,
				display_name: null,
				public_id: 'a/b',
			}),
		).toBe('overwrite=0&public_id=a/b&tags=managed-invitation,slug&unique_filename=1');
	});

	it('encodes ampersands inside a pair so a value cannot smuggle extra parameters', () => {
		const toSign = buildCloudinarySignatureString({
			context: 'sha256=abc&public_id=evil',
			public_id: 'good',
		});
		expect(toSign).toBe('context=sha256=abc%26public_id=evil&public_id=good');
		expect(
			signCloudinaryParams({ context: 'sha256=abc&public_id=evil', public_id: 'good' }, 's'),
		).toBe(createHash('sha1').update(`${toSign}s`).digest('hex'));
	});
});

describe('cloudinary REST upload form', () => {
	it('carries every signed field, the signature, the API key and the data URI file', () => {
		const form = buildCloudinaryUploadForm(
			config,
			{
				public_id: 'preview/xv/slug/assets/hero-abc',
				overwrite: false,
				tags: ['managed-invitation', 'slug'],
				asset_folder: undefined,
			},
			'data:image/webp;base64,AAAA',
			1700000000,
		);
		expect(form.get('public_id')).toBe('preview/xv/slug/assets/hero-abc');
		expect(form.get('overwrite')).toBe('0');
		expect(form.get('tags')).toBe('managed-invitation,slug');
		expect(form.get('timestamp')).toBe('1700000000');
		expect(form.get('api_key')).toBe('key-123');
		expect(form.get('file')).toBe('data:image/webp;base64,AAAA');
		expect(form.has('asset_folder')).toBe(false);
		expect(form.get('signature')).toBe(
			signCloudinaryParams(
				{
					public_id: 'preview/xv/slug/assets/hero-abc',
					overwrite: false,
					tags: ['managed-invitation', 'slug'],
					timestamp: 1700000000,
				},
				'abcd',
			),
		);
		expect(form.has('api_secret')).toBe(false);
	});
});

describe('cloudinary REST client', () => {
	it('reads a resource with Basic auth and folds the rate-limit headers into the result', async () => {
		const fetchImpl = mockFetch(() =>
			jsonResponse(
				{ public_id: 'preview/xv/slug/assets/hero-abc', width: 10 },
				{
					headers: {
						'content-type': 'application/json',
						'x-featureratelimit-limit': '500',
						'x-featureratelimit-remaining': '499',
						'x-featureratelimit-reset': 'Wed, 15 Oct 2026 00:00:00 GMT',
					},
				},
			),
		);
		const client = createCloudinaryRestClient(config, fetchImpl);

		const result = await client.getResource('preview/xv/slug/assets/hero-abc', {
			context: true,
		});

		expect(result).toMatchObject({
			public_id: 'preview/xv/slug/assets/hero-abc',
			width: 10,
			rate_limit_allowed: 500,
			rate_limit_remaining: 499,
		});
		expect(result.rate_limit_reset_at).toEqual(new Date('Wed, 15 Oct 2026 00:00:00 GMT'));
		const [url, init] = fetchImpl.mock.calls[0];
		expect(String(url)).toBe(
			'https://api.cloudinary.com/v1_1/demo%20cloud/resources/image/upload/preview/xv/slug/assets/hero-abc?context=true',
		);
		expect(init?.method).toBe('GET');
		expect((init?.headers as Record<string, string>).Authorization).toBe(
			`Basic ${Buffer.from('key-123:abcd').toString('base64')}`,
		);
	});

	it('uploads an image as multipart form data and returns the parsed body', async () => {
		const fetchImpl = mockFetch(() => jsonResponse({ public_id: 'x', version: 2 }));
		const client = createCloudinaryRestClient(config, fetchImpl);

		const result = await client.uploadImage(
			'data:image/webp;base64,AAAA',
			{ public_id: 'x', overwrite: false },
			{ timestamp: 1700000000 },
		);

		expect(result).toEqual({ public_id: 'x', version: 2 });
		const [url, init] = fetchImpl.mock.calls[0];
		expect(String(url)).toBe('https://api.cloudinary.com/v1_1/demo%20cloud/image/upload');
		expect(init?.method).toBe('POST');
		const body = init?.body as FormData;
		expect(body.get('public_id')).toBe('x');
		expect(body.get('overwrite')).toBe('0');
		expect(body.get('file')).toBe('data:image/webp;base64,AAAA');
		expect(body.get('signature')).toBe(
			signCloudinaryParams(
				{ public_id: 'x', overwrite: false, timestamp: 1700000000 },
				'abcd',
			),
		);
	});

	it.each([404, 401, 420, 500])(
		'rejects HTTP %s with http_code on the root and no request details',
		async (status) => {
			const fetchImpl = mockFetch(() =>
				jsonResponse({ error: { message: 'secret-detail key-123' } }, { status }),
			);
			const client = createCloudinaryRestClient(config, fetchImpl);

			const error = await client.getResource('missing').catch((e: unknown) => e);

			expect(error).toBeInstanceOf(CloudinaryApiError);
			expect((error as CloudinaryApiError).http_code).toBe(status);
			expect(String((error as Error).message)).toBe(`Cloudinary API HTTP ${status}`);
			expect(JSON.stringify(error)).not.toContain('key-123');
			expect(JSON.stringify(error)).not.toContain('abcd');
		},
	);

	it('rejects a network failure without a status and without echoing the request', async () => {
		const fetchImpl = mockFetch(() => {
			throw new Error('ECONNRESET abcd');
		});
		const client = createCloudinaryRestClient(config, fetchImpl);

		const error = await client.uploadImage('data:,', {}).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(CloudinaryApiError);
		expect((error as CloudinaryApiError).http_code).toBeUndefined();
		expect((error as Error).message).toBe('Cloudinary API request failed.');
	});

	it('rejects a 200 whose body is not JSON', async () => {
		const fetchImpl = mockFetch(() => new Response('<html>', { status: 200 }));
		const client = createCloudinaryRestClient(config, fetchImpl);

		await expect(client.getResource('x')).rejects.toThrow('malformed body');
	});
});
