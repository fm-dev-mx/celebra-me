import { webcrypto } from 'node:crypto';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoriesCapture from '@/components/memories/MemoriesCapture';
import {
	MemoriesRequestError,
	createMemoriesGuestApi,
	type MemoriesGuestApi,
	type MemoriesReservation,
} from '@/lib/memories/client/api';
import type {
	MemoriesGuestProfile,
	MemoriesGuestQuota,
	MemoriesMediaPublicItem,
	MemoriesSpaceSummary,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_ALLOWED_MIME_TYPES,
	MEMORIES_MAX_IMAGE_BYTES,
	MEMORIES_MAX_VIDEO_BYTES,
} from '@/lib/memories/contract/media-policy';
import { memoriesCaptureCopy as copy } from '@/lib/memories/copy';
import { fetchPutTransport } from '@/lib/memories/client/upload-pipeline';

jest.mock('@/lib/memories/client/api', () => {
	const actual = jest.requireActual<typeof import('@/lib/memories/client/api')>(
		'@/lib/memories/client/api',
	);
	return { ...actual, createMemoriesGuestApi: jest.fn() };
});

jest.mock('@/lib/memories/client/media-prep', () => {
	const actual = jest.requireActual<typeof import('@/lib/memories/client/media-prep')>(
		'@/lib/memories/client/media-prep',
	);
	return {
		...actual,
		optimizeMemoriesImage: jest.fn(async (file: File) => file),
		measureVideoDurationSeconds: jest.fn(async () => 5),
		calculateFileSha256Hex: jest.fn(async () => 'ab'.repeat(32)),
	};
});

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

const PUBLIC_SLUG = 'victoria-y-roberto';
const CHECKSUM = 'ab'.repeat(32);

const PROFILE: MemoriesGuestProfile = {
	displayName: 'Tía Ana',
	expiresAt: '2027-01-30T06:00:00.000Z',
};

const QUOTA: MemoriesGuestQuota = {
	files: { used: 0, remaining: 20, limit: 20 },
	videos: { used: 0, remaining: 5, limit: 5 },
	bytes: { used: 0, remaining: 512 * 1024 * 1024, limit: 512 * 1024 * 1024 },
	inFlight: { used: 0, remaining: 2, limit: 2 },
};

function buildSpace(windowState: MemoriesSpaceSummary['windowState']): MemoriesSpaceSummary {
	return {
		publicSlug: PUBLIC_SLUG,
		eventTitle: 'Boda de Victoria y Roberto',
		timeZone: 'America/Mazatlan',
		uploadStartsAt: '2026-10-30T18:00:00.000Z',
		uploadEndsAt: '2026-11-02T06:00:00.000Z',
		retentionEndsAt: '2027-01-30T06:00:00.000Z',
		windowState,
	};
}

function buildItem(overrides: Partial<MemoriesMediaPublicItem> = {}): MemoriesMediaPublicItem {
	return {
		id: 'item-1',
		mimeType: 'image/png',
		sizeBytes: 4,
		durationSeconds: null,
		caption: '',
		status: 'uploading',
		createdAt: '2026-10-31T02:00:00.000Z',
		updatedAt: '2026-10-31T02:00:00.000Z',
		acceptedAt: null,
		rejectedAt: null,
		deletedAt: null,
		hasThumbnail: false,
		...overrides,
	};
}

function buildReservation(): MemoriesReservation & {
	upload: NonNullable<MemoriesReservation['upload']>;
} {
	return {
		item: buildItem(),
		upload: {
			uploadUrl: 'https://memories-upload.example.invalid/upload/victoria-y-roberto',
			requiredHeaders: {
				Authorization: 'Bearer capability.signature',
				'Content-Type': 'image/png',
				'x-amz-checksum-sha256': CHECKSUM,
			},
			expiresAt: '2026-10-31T02:05:00.000Z',
		},
	};
}

function createGuestApiFake(): jest.Mocked<MemoriesGuestApi> {
	const itemsUrl = `/api/memories/${PUBLIC_SLUG}/items`;
	const fake = {
		itemsUrl,
		itemMediaUrl: jest.fn((itemId: string) => `${itemsUrl}/${encodeURIComponent(itemId)}`),
		itemThumbnailUrl: jest.fn(
			(itemId: string) => `${itemsUrl}/${encodeURIComponent(itemId)}?variant=thumb`,
		),
		getSession: jest.fn(),
		createSession: jest.fn(),
		recoverSession: jest.fn(),
		updateProfile: jest.fn(),
		listItems: jest.fn(),
		reserve: jest.fn(),
		complete: jest.fn(),
		updateCaption: jest.fn(),
		deleteItem: jest.fn(),
	};
	return fake as unknown as jest.Mocked<MemoriesGuestApi>;
}

function httpResponse(status: number): Response {
	return { ok: status >= 200 && status < 300, status, json: async () => null } as Response;
}

const mockedCreateGuestApi = createMemoriesGuestApi as jest.MockedFunction<
	typeof createMemoriesGuestApi
>;

const pngFile = (name = 'familia.png') =>
	new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'image/png' });

describe('MemoriesCapture island', () => {
	let guestApi: jest.Mocked<MemoriesGuestApi>;

	beforeEach(() => {
		// The global fetch stub from tests/setup.ts keeps its call history across tests.
		(globalThis.fetch as jest.Mock).mockClear();
		guestApi = createGuestApiFake();
		mockedCreateGuestApi.mockReset();
		mockedCreateGuestApi.mockReturnValue(guestApi);
		guestApi.listItems.mockResolvedValue({ items: [], quota: QUOTA });
	});

	type Space = MemoriesSpaceSummary['windowState'];
	type User = ReturnType<typeof userEvent.setup>;

	function renderCapture(
		windowState: Space = 'open',
		props: Partial<Parameters<typeof MemoriesCapture>[0]> = {},
	) {
		return render(
			<MemoriesCapture
				space={buildSpace(windowState)}
				maxSessionVideos={5}
				putFile={fetchPutTransport}
				{...props}
			/>,
		);
	}

	async function pickFiles(user: User, ...files: File[]) {
		await user.upload(await screen.findByLabelText(copy.chooseFile), files);
	}

	async function uploadPicked(user: User) {
		await user.click(screen.getByRole('button', { name: /^Subir \d+ recuerdos?$/ }));
	}

	it('builds the guest API from the public slug received in the space summary', async () => {
		guestApi.getSession.mockResolvedValue(null);

		renderCapture();

		await waitFor(() => expect(guestApi.getSession).toHaveBeenCalledTimes(1));
		expect(mockedCreateGuestApi).toHaveBeenCalledWith(PUBLIC_SLUG);
	});

	it('asks a fresh visitor for a name once before offering the file picker', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(null);
		guestApi.createSession.mockResolvedValue({
			profile: PROFILE,
			recoveryCode: 'ABCD-EFGH-JKLM',
		});

		renderCapture();

		const nameInput = screen.getByLabelText(copy.displayNameLabel);
		expect(screen.getByText(copy.welcomeNameHelp)).toBeInTheDocument();
		expect(screen.queryByLabelText(copy.chooseFile)).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: copy.continueLabel })).toBeDisabled();

		await user.type(nameInput, PROFILE.displayName);
		await user.click(screen.getByRole('button', { name: copy.continueLabel }));

		expect(await screen.findByLabelText(copy.chooseFile)).toBeEnabled();
		expect(guestApi.createSession).toHaveBeenCalledWith(PROFILE.displayName);
		expect(screen.getByText(PROFILE.displayName)).toBeInTheDocument();
		// The recovery code waits for the first saved memory, when it starts to matter.
		expect(screen.queryByText('ABCD-EFGH-JKLM')).not.toBeInTheDocument();
		expect(guestApi.listItems).toHaveBeenCalled();
	});

	it('shows the recovery code after the first saved memory', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(null);
		guestApi.createSession.mockResolvedValue({
			profile: PROFILE,
			recoveryCode: 'ABCD-EFGH-JKLM',
		});
		guestApi.reserve.mockResolvedValue(buildReservation());
		guestApi.complete.mockResolvedValue({ item: buildItem({ status: 'accepted' }) });
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(201));

		renderCapture();
		await user.type(screen.getByLabelText(copy.displayNameLabel), PROFILE.displayName);
		await user.click(screen.getByRole('button', { name: copy.continueLabel }));
		await pickFiles(user, pngFile());
		await uploadPicked(user);

		expect(await screen.findByText('ABCD-EFGH-JKLM')).toBeInTheDocument();
		expect(screen.getByText(copy.recoveryCodeTitle)).toBeInTheDocument();
		expect(screen.getByText(copy.thanks(PROFILE.displayName))).toBeInTheDocument();
	});

	it('reserves, PUTs the file to the signed upload URL with the required headers, then completes', async () => {
		const user = userEvent.setup();
		const reservation = buildReservation();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockResolvedValue(reservation);
		guestApi.complete.mockResolvedValue({ item: buildItem({ status: 'accepted' }) });
		const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(200));

		renderCapture();
		await screen.findByText(PROFILE.displayName);

		const file = pngFile();
		await pickFiles(user, file);
		expect(screen.getByText('familia.png')).toBeInTheDocument();
		expect(guestApi.reserve).not.toHaveBeenCalled();

		await user.click(screen.getByRole('button', { name: copy.confirmUploadCount(1) }));

		expect(await screen.findByText(copy.successCount(1))).toBeInTheDocument();

		expect(guestApi.reserve).toHaveBeenCalledTimes(1);
		const reserveInput = guestApi.reserve.mock.calls[0][0];
		expect(reserveInput).toMatchObject({
			mimeType: 'image/png',
			sizeBytes: file.size,
			checksumSha256: CHECKSUM,
			durationSeconds: undefined,
		});
		expect(reserveInput.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [putUrl, putInit] = fetchMock.mock.calls[0];
		expect(putUrl).toBe(reservation.upload.uploadUrl);
		expect(putInit).toMatchObject({
			method: 'PUT',
			headers: reservation.upload.requiredHeaders,
		});
		expect((putInit as RequestInit).body).toBeInstanceOf(File);

		expect(guestApi.complete).toHaveBeenCalledWith(reservation.item.id);
		const reserveOrder = guestApi.reserve.mock.invocationCallOrder[0];
		const putOrder = fetchMock.mock.invocationCallOrder[0];
		const completeOrder = guestApi.complete.mock.invocationCallOrder[0];
		expect(reserveOrder).toBeLessThan(putOrder);
		expect(putOrder).toBeLessThan(completeOrder);
	});

	it('uploads several files with one caption and counts the saved ones', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		let next = 0;
		guestApi.reserve.mockImplementation(async () => {
			next += 1;
			return { ...buildReservation(), item: buildItem({ id: `item-${next}` }) };
		});
		guestApi.complete.mockResolvedValue({ item: buildItem({ status: 'accepted' }) });
		guestApi.updateCaption.mockResolvedValue({ item: buildItem() });
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(201));

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, pngFile('uno.png'), pngFile('dos.png'), pngFile('tres.png'));
		expect(screen.getByRole('heading', { name: copy.reviewTitle(3) })).toBeInTheDocument();

		await user.click(screen.getByText(copy.captionToggle));
		await user.type(screen.getByLabelText(copy.captionLabelAll), 'Primer baile');
		await user.click(screen.getByRole('button', { name: copy.confirmUploadCount(3) }));

		expect(await screen.findByText(copy.successCount(3))).toBeInTheDocument();
		expect(guestApi.reserve).toHaveBeenCalledTimes(3);
		expect(guestApi.updateCaption).toHaveBeenCalledTimes(3);
		expect(guestApi.updateCaption).toHaveBeenCalledWith('item-2', 'Primer baile');
		expect(
			new Set(guestApi.reserve.mock.calls.map(([input]) => input.clientRequestId)).size,
		).toBe(3);
	});

	it('lets the guest drop a picked file before uploading', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, pngFile('uno.png'), pngFile('dos.png'));
		await user.click(screen.getByRole('button', { name: copy.removeFile('uno.png') }));

		expect(screen.queryByText('uno.png')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: copy.confirmUploadCount(1) })).toBeEnabled();
	});

	it('hides the upload panel when the window is closed while keeping the guest catalog', async () => {
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.listItems.mockResolvedValue({
			items: [buildItem({ id: 'accepted-item', status: 'accepted', caption: 'Familia' })],
			quota: QUOTA,
		});

		renderCapture('closed');

		expect(await screen.findByRole('heading', { name: /Mis recuerdos/ })).toBeInTheDocument();
		expect(await screen.findByRole('img', { name: 'Familia' })).toHaveAttribute(
			'src',
			`/api/memories/${PUBLIC_SLUG}/items/accepted-item?variant=thumb`,
		);
		expect(screen.getByText(PROFILE.displayName)).toBeInTheDocument();
		expect(screen.queryByLabelText(copy.chooseFile)).not.toBeInTheDocument();
	});

	it('offers a calendar reminder instead of the form before the window opens', async () => {
		guestApi.getSession.mockResolvedValue(null);

		renderCapture('before');

		expect(screen.getByRole('button', { name: copy.addToCalendar })).toBeInTheDocument();
		expect(screen.queryByLabelText(copy.displayNameLabel)).not.toBeInTheDocument();
	});

	it('deletes one of the guest memories after confirming in its options', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.listItems.mockResolvedValue({
			items: [buildItem({ id: 'accepted-item', status: 'accepted', caption: 'Familia' })],
			quota: QUOTA,
		});
		guestApi.deleteItem.mockResolvedValue({ success: true });

		renderCapture();
		await user.click(await screen.findByRole('button', { name: /Familia/ }));
		const sheet = screen.getByRole('dialog', { name: copy.memoryOptions });
		await user.click(within(sheet).getByRole('button', { name: copy.deleteMemory }));
		expect(within(sheet).getByText(copy.deleteBody)).toBeInTheDocument();
		await user.click(within(sheet).getByRole('button', { name: copy.deleteMemory }));

		await waitFor(() => expect(guestApi.deleteItem).toHaveBeenCalledWith('accepted-item'));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('rejects an oversized image locally without reserving capacity', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(200));

		renderCapture();
		await screen.findByText(PROFILE.displayName);

		const oversized = new File([new Uint8Array(MEMORIES_MAX_IMAGE_BYTES + 1)], 'grande.png', {
			type: 'image/png',
		});
		await pickFiles(user, oversized);
		await uploadPicked(user);

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.fileTooLarge);
		expect(guestApi.reserve).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('confirms a replayed upload whose bytes already arrived without sending them again', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockResolvedValue({
			item: buildItem({ status: 'validating' }),
			upload: null,
		});
		guestApi.complete.mockResolvedValue({ item: buildItem({ status: 'accepted' }) });
		const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(200));

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, pngFile());
		await uploadPicked(user);

		expect(await screen.findByText(copy.successCount(1))).toBeInTheDocument();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(guestApi.complete).toHaveBeenCalledWith('item-1');
	});

	it.each([
		['a closed reservation', 'reserve'],
		['a released reservation', 'complete'],
	] as const)('starts over with a new request id after %s', async (_label, failingStep) => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		if (failingStep === 'reserve') {
			guestApi.reserve.mockRejectedValueOnce(new MemoriesRequestError(409, 'conflict'));
		} else {
			guestApi.reserve.mockResolvedValueOnce(buildReservation());
			guestApi.complete.mockRejectedValueOnce(new MemoriesRequestError(404, 'not_found'));
			jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(200));
		}

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, pngFile());
		await uploadPicked(user);

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.uploadExpired);
		expect(guestApi.complete).toHaveBeenCalledTimes(failingStep === 'complete' ? 1 : 0);

		guestApi.reserve.mockRejectedValueOnce(new MemoriesRequestError(429, 'rate_limited'));
		await user.click(screen.getByRole('button', { name: copy.retry }));

		await waitFor(() => expect(guestApi.reserve).toHaveBeenCalledTimes(2));
		const [first, second] = guestApi.reserve.mock.calls.map(([input]) => input);
		expect(second.clientRequestId).not.toBe(first.clientRequestId);
	});

	it('maps a 429 reservation failure to the rate-limited copy', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockRejectedValue(new MemoriesRequestError(429, 'rate_limited'));

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, pngFile('rapido.png'));
		await uploadPicked(user);

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.rateLimited);
		expect(guestApi.reserve).toHaveBeenCalledTimes(1);
		expect(guestApi.complete).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: copy.retry })).toBeInTheDocument();
	});

	it.each([
		['a throttled request', new MemoriesRequestError(429, 'rate_limited'), copy.rateLimited],
		['an unavailable space', new MemoriesRequestError(404, 'not_found'), copy.unavailable],
		['a dropped connection', new MemoriesRequestError(null), copy.unavailable],
	])('says why the session could not start after %s', async (_label, failure, message) => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(null);
		guestApi.createSession.mockRejectedValueOnce(failure);

		renderCapture();
		await user.type(screen.getByLabelText(copy.displayNameLabel), PROFILE.displayName);
		await user.click(screen.getByRole('button', { name: copy.continueLabel }));

		expect(await screen.findByRole('alert')).toHaveTextContent(message);

		guestApi.createSession.mockResolvedValueOnce({ profile: PROFILE, recoveryCode: null });
		await user.click(screen.getByRole('button', { name: copy.continueLabel }));

		expect(await screen.findByLabelText(copy.chooseFile)).toBeEnabled();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('says that the session lookup failed on arrival instead of staying silent', async () => {
		guestApi.getSession.mockRejectedValue(new MemoriesRequestError(503, 'service_unavailable'));

		renderCapture();

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.unavailable);
		expect(screen.getByLabelText(copy.displayNameLabel)).toBeInTheDocument();
	});

	it('says why the display name could not be saved', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.updateProfile.mockRejectedValue(new MemoriesRequestError(401, 'unauthorized'));

		renderCapture();
		await user.click(await screen.findByRole('button', { name: copy.changeName }));
		await user.click(screen.getByRole('button', { name: copy.saveLabel }));

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.sessionLost);
	});

	it('treats a file the storage already holds as sent and goes on to confirm it', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockResolvedValue(buildReservation());
		guestApi.complete.mockResolvedValue({ item: buildItem({ status: 'accepted' }) });
		// The first PUT stored the object but its response was lost; the retry gets 412.
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(412));

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, pngFile());
		await uploadPicked(user);

		expect(await screen.findByText(copy.successCount(1))).toBeInTheDocument();
		expect(guestApi.complete).toHaveBeenCalledWith('item-1');
	});

	it('retries a failed video upload with the same request id and duration', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockResolvedValue(buildReservation());
		guestApi.complete.mockResolvedValue({ item: buildItem({ status: 'accepted' }) });
		jest.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new TypeError('Load failed'))
			.mockResolvedValue(httpResponse(201));

		renderCapture('open', { readVideoDurationSeconds: async () => 12.345678 });
		await screen.findByText(PROFILE.displayName);
		await pickFiles(
			user,
			new File([new Uint8Array([1, 2, 3, 4])], 'baile.mov', { type: 'video/quicktime' }),
		);
		await uploadPicked(user);
		expect(await screen.findByRole('alert')).toHaveTextContent(copy.putFailed);

		await user.click(screen.getByRole('button', { name: copy.retry }));

		expect(await screen.findByText(copy.successCount(1))).toBeInTheDocument();
		const [first, second] = guestApi.reserve.mock.calls.map(([input]) => input);
		expect(second).toEqual(first);
		expect(first).toMatchObject({ mimeType: 'video/quicktime', durationSeconds: 12.345678 });
	});

	it.each([
		['the per-guest file limit', 'session_files', copy.sessionFilesReached],
		['the per-guest video limit', 'session_videos', copy.sessionVideosReached],
		['the per-guest storage limit', 'session_bytes', copy.sessionBytesReached],
		['the event capacity', 'event_capacity', copy.eventFull],
	])('names %s when the reservation is refused', async (_label, reason, message) => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockRejectedValue(new MemoriesRequestError(409, 'limit_reached', reason));

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, pngFile());
		await uploadPicked(user);

		expect(await screen.findByRole('alert')).toHaveTextContent(message);
	});

	it('stops the rest of the batch once the guest file limit is reached', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockRejectedValue(
			new MemoriesRequestError(409, 'limit_reached', 'session_files'),
		);

		renderCapture('open', {});
		await screen.findByText(PROFILE.displayName);
		await pickFiles(
			user,
			pngFile('a.png'),
			pngFile('b.png'),
			pngFile('c.png'),
			pngFile('d.png'),
		);
		await uploadPicked(user);

		expect(await screen.findAllByText(copy.sessionFilesReached)).toHaveLength(4);
		// Two ran at once; the two still waiting were not attempted.
		expect(guestApi.reserve).toHaveBeenCalledTimes(2);
	});

	it('stops confirming and asks to reload when the session is gone', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockResolvedValue(buildReservation());
		guestApi.complete.mockRejectedValue(new MemoriesRequestError(401, 'unauthorized'));
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(201));

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, pngFile());
		await uploadPicked(user);

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.sessionLost);
		expect(guestApi.complete).toHaveBeenCalledTimes(1);
	});

	it('explains an upload that failed validation instead of a bare status word', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockResolvedValue(buildReservation());
		guestApi.complete.mockResolvedValue({ item: buildItem({ status: 'rejected' }) });
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(201));

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, pngFile());
		await uploadPicked(user);

		expect(await screen.findByText(copy.completionRejected)).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: copy.noneSaved })).toBeInTheDocument();
		expect(screen.queryByText(copy.successCount(1))).not.toBeInTheDocument();
	});

	it('waits while the guest is offline and resumes on its own when the signal returns', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockResolvedValue(buildReservation());
		guestApi.complete.mockResolvedValue({ item: buildItem({ status: 'accepted' }) });
		const online = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(201));

		try {
			renderCapture();
			await screen.findByText(PROFILE.displayName);
			await pickFiles(user, pngFile());
			await uploadPicked(user);

			expect(await screen.findByText(copy.offline)).toBeInTheDocument();
			expect(screen.getByText(copy.statusWaiting)).toBeInTheDocument();
			expect(guestApi.reserve).not.toHaveBeenCalled();

			online.mockReturnValue(true);
			act(() => {
				window.dispatchEvent(new Event('online'));
			});

			expect(await screen.findByText(copy.successCount(1))).toBeInTheDocument();
			expect(guestApi.reserve).toHaveBeenCalledTimes(1);
		} finally {
			online.mockRestore();
		}
	});

	it('after a reload mid-upload, shows the pending file and explains why a new upload must wait', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		// The page was reloaded while two files were uploading: the server still holds both slots.
		guestApi.listItems.mockResolvedValue({
			items: [
				buildItem({ id: 'pending-1', status: 'uploading' }),
				buildItem({ id: 'pending-2', status: 'uploading' }),
			],
			quota: { ...QUOTA, inFlight: { used: 2, remaining: 0, limit: 2 } },
		});
		guestApi.reserve.mockRejectedValue(
			new MemoriesRequestError(429, 'rate_limited', 'uploads_in_progress'),
		);

		renderCapture();

		expect(await screen.findAllByText(copy.validationPending)).toHaveLength(2);
		await pickFiles(user, pngFile());
		await uploadPicked(user);

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.uploadsInProgress);
	});

	it('offers the file picker every format the upload policy accepts, several at a time', async () => {
		guestApi.getSession.mockResolvedValue(PROFILE);

		renderCapture();

		const input = await screen.findByLabelText(copy.chooseFile);
		expect(input.getAttribute('accept')?.split(',').sort()).toEqual(
			Object.keys(MEMORIES_ALLOWED_MIME_TYPES).sort(),
		);
		expect(input).toHaveAttribute('multiple');
	});

	it('flags an oversized video in the preview with advice, before anything is sent', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		const oversized = new File([new Uint8Array(4)], 'baile.mp4', { type: 'video/mp4' });
		Object.defineProperty(oversized, 'size', { value: MEMORIES_MAX_VIDEO_BYTES + 1 });

		renderCapture();
		await screen.findByText(PROFILE.displayName);
		await pickFiles(user, oversized);

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.videoTooLarge);
		expect(screen.getByRole('button', { name: copy.confirmUploadCount(0) })).toBeDisabled();
		expect(guestApi.reserve).not.toHaveBeenCalled();
	});
});
