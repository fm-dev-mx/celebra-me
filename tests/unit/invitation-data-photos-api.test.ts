/**
 * @jest-environment node
 */
jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

jest.mock('@/lib/invitation-data/service', () => ({
	uploadInvitationDataPhoto: jest.fn(),
	deleteInvitationDataPhoto: jest.fn(),
}));

import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import {
	deleteInvitationDataPhoto,
	uploadInvitationDataPhoto,
} from '@/lib/invitation-data/service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { DELETE as deletePhoto, POST as uploadPhoto } from '@/pages/api/mi-invitacion/photos';
import { createApiContext } from '../helpers/api-mocks';

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
	fn as unknown as jest.MockedFunction<T>;

const TOKEN = 'a'.repeat(43);
const PHOTOS_URL = 'https://www.celebra-me.com/api/mi-invitacion/photos';

function createPostRequest(formData: FormData): Request {
	return new Request(PHOTOS_URL, {
		method: 'POST',
		body: formData,
	});
}

function createDeleteRequest(body: unknown): Request {
	return new Request(PHOTOS_URL, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	jest.clearAllMocks();
	mocked(checkRateLimit).mockResolvedValue(true);
});

describe('POST /api/mi-invitacion/photos', () => {
	it('uploads photo when rate limit passes and parameters are valid', async () => {
		const mockPhoto = {
			id: 'photo-1',
			url: 'https://cdn.celebra-me.com/photo-1.jpg',
			name: 'portada.jpg',
			size: 2048,
			type: 'image/jpeg',
			uploadedAt: '2026-10-26T18:00:00.000Z',
		};
		mocked(uploadInvitationDataPhoto).mockResolvedValue({
			photo: mockPhoto,
			answers: { photos: [mockPhoto] },
		});

		const formData = new FormData();
		formData.append('token', TOKEN);
		const file = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
		formData.append('file', file, 'portada.jpg');

		const response = await uploadPhoto(createApiContext(createPostRequest(formData)) as never);

		expect(response.status).toBe(200);
		const json = (await response.json()) as { data: { photo: unknown; answers: unknown } };
		expect(json.data.photo).toEqual(mockPhoto);
		expect(mocked(uploadInvitationDataPhoto)).toHaveBeenCalledWith(
			expect.objectContaining({
				token: TOKEN,
				fileName: 'portada.jpg',
				mimeType: 'image/jpeg',
			}),
		);
	});

	it('rejects when rate limited', async () => {
		mocked(checkRateLimit).mockResolvedValue(false);

		const formData = new FormData();
		formData.append('token', TOKEN);
		const file = new Blob(['bytes'], { type: 'image/jpeg' });
		formData.append('file', file, 'test.jpg');

		const response = await uploadPhoto(createApiContext(createPostRequest(formData)) as never);
		expect(response.status).toBe(429);
	});

	it('rejects missing token or file', async () => {
		const formDataNoToken = new FormData();
		formDataNoToken.append('file', new Blob(['b'], { type: 'image/jpeg' }), 'f.jpg');
		const res1 = await uploadPhoto(
			createApiContext(createPostRequest(formDataNoToken)) as never,
		);
		expect(res1.status).toBe(400);

		const formDataNoFile = new FormData();
		formDataNoFile.append('token', TOKEN);
		const res2 = await uploadPhoto(
			createApiContext(createPostRequest(formDataNoFile)) as never,
		);
		expect(res2.status).toBe(400);
	});

	it('returns service errors with status code', async () => {
		mocked(uploadInvitationDataPhoto).mockRejectedValue(
			new ApiError(400, 'bad_request', 'La foto no debe superar los 10 MB.'),
		);

		const formData = new FormData();
		formData.append('token', TOKEN);
		formData.append('file', new Blob(['bytes'], { type: 'image/jpeg' }), 'big.jpg');

		const response = await uploadPhoto(createApiContext(createPostRequest(formData)) as never);
		expect(response.status).toBe(400);
		const json = (await response.json()) as { error: { message: string } };
		expect(json.error.message).toContain('10 MB');
	});
});

describe('DELETE /api/mi-invitacion/photos', () => {
	it('deletes photo through service and returns updated answers', async () => {
		mocked(deleteInvitationDataPhoto).mockResolvedValue({
			success: true,
			answers: { photos: [] },
		});

		const response = await deletePhoto(
			createApiContext(createDeleteRequest({ token: TOKEN, photoId: 'photo-1' })) as never,
		);

		expect(response.status).toBe(200);
		const json = (await response.json()) as { data: { success: boolean; answers: unknown } };
		expect(json.data.success).toBe(true);
		expect(mocked(deleteInvitationDataPhoto)).toHaveBeenCalledWith({
			token: TOKEN,
			photoId: 'photo-1',
		});
	});

	it('rejects missing token or photoId', async () => {
		const res1 = await deletePhoto(
			createApiContext(createDeleteRequest({ token: TOKEN })) as never,
		);
		expect(res1.status).toBe(400);

		const res2 = await deletePhoto(
			createApiContext(createDeleteRequest({ photoId: 'photo-1' })) as never,
		);
		expect(res2.status).toBe(400);
	});
});
