/** @jest-environment node */
jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));
jest.mock('@/lib/commercial/meta-capi/service', () => ({ deliverMetaConversionEvent: jest.fn() }));
jest.mock('@/lib/intake/storage', () => ({
	uploadToStorage: jest.fn().mockResolvedValue('ok'),
	deleteFromStorage: jest.fn().mockResolvedValue(undefined),
	getPublicUrl: (_bucket: string, path: string) => `https://example.invalid/${path}`,
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { deleteFromStorage, uploadToStorage } from '@/lib/intake/storage';
import {
	deleteInvitationDataPhoto,
	saveInvitationDataForm,
	uploadInvitationDataPhoto,
} from '@/lib/invitation-data/service';
import type { InvitationDataAnswers, InvitationDataPhoto } from '@/lib/invitation-data/form';

const TOKEN = 'A'.repeat(43);
const NOW = new Date('2026-10-27T12:00:00Z');
const PHOTO: InvitationDataPhoto = {
	id: '11111111-1111-4111-8111-111111111111',
	url: 'https://example.invalid/photo.jpg',
	name: 'foto.jpg',
	size: 10,
	type: 'image/jpeg',
};
let answers: InvitationDataAnswers;
let beforePatch: (() => void) | undefined;
let rejectWrites: boolean;
let revision: number;
const updatedAt = () => `2026-10-27T12:00:00.${String(revision).padStart(6, '0')}+00:00`;

beforeEach(() => {
	jest.clearAllMocks();
	answers = { song: 'Original' };
	beforePatch = undefined;
	rejectWrites = false;
	revision = 0;
	jest.mocked(deleteFromStorage).mockResolvedValue(undefined);
	jest.mocked(supabaseRestRequest).mockImplementation(async (input) => {
		const query = new URL(`https://example.invalid/${input.pathWithQuery}`).searchParams;
		if (input.method === 'PATCH') {
			if (beforePatch) {
				beforePatch();
				revision += 1;
			}
			beforePatch = undefined;
			// Model the database-managed updated_at guard at the persistence boundary.
			expect(query.get('token_hash')).toMatch(/^eq\.[a-f0-9]{64}$/u);
			const expected = query.get('updated_at');
			if (rejectWrites || expected !== `eq.${updatedAt()}`) return [];
			answers = (input.body as { answers: InvitationDataAnswers }).answers;
			revision += 1;
		}
		return [
			{
				id: 'request-1',
				updated_at: updatedAt(),
				order_id: 'order-1',
				answers: structuredClone(answers),
				status: 'in_progress',
				token_issued_at: NOW.toISOString(),
				expires_at: '2026-12-25T00:00:00Z',
				last_saved_at: null,
				submitted_at: null,
				owner_reviewed_at: null,
				sales_orders: {
					id: 'order-1',
					status: 'deposit_paid',
					customers: null,
					leads: null,
				},
			},
		];
	});
});

const upload = () =>
	uploadInvitationDataPhoto({
		token: TOKEN,
		file: new Blob(['image']),
		fileName: 'foto.jpg',
		mimeType: 'image/jpeg',
		now: NOW,
	});

it('retries an upload without overwriting a concurrent text save or photo upload', async () => {
	beforePatch = () => {
		answers = { song: 'Concurrent text', photos: [PHOTO] };
	};
	const result = await upload();
	expect(result.answers.song).toBe('Concurrent text');
	expect(result.answers.photos).toEqual([PHOTO, result.photo]);
	expect(uploadToStorage).toHaveBeenCalledTimes(1);
	expect(deleteFromStorage).not.toHaveBeenCalled();
});

it('preserves server photo membership when a stale autosave races an upload', async () => {
	beforePatch = () => {
		answers = { ...answers, photos: [PHOTO] };
	};
	await saveInvitationDataForm({ token: TOKEN, answers: { song: 'Edited text' }, now: NOW });
	expect(answers).toEqual({ song: 'Edited text', photos: [PHOTO] });
});

it('cannot restore a deleted photo through a stale form save', async () => {
	await saveInvitationDataForm({
		token: TOKEN,
		answers: { song: 'Edited', photos: [PHOTO] },
		now: NOW,
	});
	expect(answers).toEqual({ song: 'Edited' });
});

it('deletes the authorized object and preserves concurrent text and other photos', async () => {
	answers.photos = [PHOTO];
	const other = { ...PHOTO, id: '22222222-2222-4222-8222-222222222222' };
	beforePatch = () => {
		answers = { song: 'Concurrent text', photos: [PHOTO, other] };
	};
	await deleteInvitationDataPhoto({ token: TOKEN, photoId: PHOTO.id, now: NOW });
	expect(deleteFromStorage).toHaveBeenCalledWith(
		'invitation-assets',
		`invitation-data/order-1/${PHOTO.id}.jpg`,
	);
	expect(answers).toEqual({ song: 'Concurrent text', photos: [other] });
});

it('keeps the reference and reports failure if Storage deletion fails', async () => {
	answers.photos = [PHOTO];
	jest.mocked(deleteFromStorage).mockRejectedValueOnce(new Error('storage unavailable'));
	await expect(
		deleteInvitationDataPhoto({ token: TOKEN, photoId: PHOTO.id, now: NOW }),
	).rejects.toThrow('storage unavailable');
	expect(answers.photos).toEqual([PHOTO]);
	expect(
		jest.mocked(supabaseRestRequest).mock.calls.filter(([input]) => input.method === 'PATCH'),
	).toHaveLength(0);
});

it('never deletes an unowned object', async () => {
	await deleteInvitationDataPhoto({ token: TOKEN, photoId: PHOTO.id, now: NOW });
	expect(deleteFromStorage).not.toHaveBeenCalled();
});

it('bounds contention retries and cleans an upload that cannot be recorded', async () => {
	rejectWrites = true;
	await expect(upload()).rejects.toMatchObject({ status: 409 });
	expect(
		jest.mocked(supabaseRestRequest).mock.calls.filter(([input]) => input.method === 'PATCH'),
	).toHaveLength(3);
	expect(deleteFromStorage).toHaveBeenCalledTimes(1);
});

it('does not delete an uploaded object after an ambiguous database transport failure', async () => {
	jest.mocked(supabaseRestRequest)
		.mockResolvedValueOnce([
			{
				id: 'request-1',
				order_id: 'order-1',
				answers: {},
				status: 'in_progress',
				expires_at: '2026-12-25T00:00:00Z',
				sales_orders: { id: 'order-1' },
			},
		])
		.mockRejectedValueOnce(new Error('response lost after commit'));
	await expect(upload()).rejects.toThrow('response lost after commit');
	expect(deleteFromStorage).not.toHaveBeenCalled();
});

it('rechecks the photo limit after a concurrent upload and removes the rejected object', async () => {
	beforePatch = () => {
		answers.photos = Array.from({ length: 10 }, () => PHOTO);
	};
	await expect(upload()).rejects.toMatchObject({ status: 400 });
	expect(answers.photos).toHaveLength(10);
	expect(deleteFromStorage).toHaveBeenCalledTimes(1);
});

it('keeps the write URL bounded and free of client answers', async () => {
	answers = { notes: 'Private answer '.repeat(1000), photos: [PHOTO] };
	await upload();
	const [input] = jest
		.mocked(supabaseRestRequest)
		.mock.calls.find(([call]) => call.method === 'PATCH')!;
	expect(input.pathWithQuery.length).toBeLessThan(512);
	expect(input.pathWithQuery).not.toContain('Private');
});
