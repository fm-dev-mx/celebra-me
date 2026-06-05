const mockGetSupabaseUrl = jest.fn();
const mockGetSupabaseServiceRoleKey = jest.fn();

jest.mock('@/lib/server/supabase-credentials', () => ({
	getSupabaseUrl: mockGetSupabaseUrl,
	getSupabaseServiceRoleKey: mockGetSupabaseServiceRoleKey,
}));

import { uploadToStorage } from '@/lib/intake/storage';

const SECRET_KEY = 'sb_secret_test_123456789';

describe('uploadToStorage', () => {
	beforeEach(() => {
		jest.restoreAllMocks();
		mockGetSupabaseUrl.mockReturnValue('http://127.0.0.1:54321');
		mockGetSupabaseServiceRoleKey.mockReturnValue(SECRET_KEY);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('sends both apikey and Authorization headers for Storage uploads', async () => {
		const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
		} as Response);

		await uploadToStorage(
			'invitation-assets',
			'invitations/inv-1/original/asset.webp',
			new Blob(['image']),
			'image/webp',
		);

		expect(fetchSpy).toHaveBeenCalledWith(
			'http://127.0.0.1:54321/storage/v1/object/invitation-assets/invitations/inv-1/original/asset.webp',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					apikey: SECRET_KEY,
					Authorization: `Bearer ${SECRET_KEY}`,
					'Content-Type': 'image/webp',
				}),
			}),
		);
	});

	it('maps invalid Storage JWT errors to a sanitized authorization message', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
			text: async () =>
				`{"statusCode":"403","error":"Unauthorized","message":"Invalid Compact JWS","key":"${SECRET_KEY}"}`,
		} as Response);

		let error: unknown;
		try {
			await uploadToStorage(
				'invitation-assets',
				'invitations/inv-1/original/asset.webp',
				new Blob(['image']),
				'image/webp',
			);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('No se pudo autorizar la carga de la imagen.');
		expect((error as Error).message).not.toContain(SECRET_KEY);
		expect(console.error).toHaveBeenCalledWith(
			'[storage] Storage upload failed:',
			expect.objectContaining({
				body: expect.stringContaining('<redacted>'),
			}),
		);
	});
});
