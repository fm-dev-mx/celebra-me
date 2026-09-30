import { webcrypto } from 'node:crypto';
import { render, screen, waitFor } from '@testing-library/react';
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
import { MEMORIES_MAX_IMAGE_BYTES } from '@/lib/memories/contract/media-policy';
import { memoriesCaptureCopy as copy } from '@/lib/memories/copy';

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
		...overrides,
	};
}

function buildReservation(): MemoriesReservation {
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

	it('builds the guest API from the public slug received in the space summary', async () => {
		guestApi.getSession.mockResolvedValue(null);

		render(<MemoriesCapture space={buildSpace('open')} maxSessionVideos={5} />);

		await waitFor(() => expect(guestApi.getSession).toHaveBeenCalledTimes(1));
		expect(mockedCreateGuestApi).toHaveBeenCalledWith(PUBLIC_SLUG);
	});

	it('onboards a fresh visitor with a display name and shows the recovery code card', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(null);
		guestApi.createSession.mockResolvedValue({
			profile: PROFILE,
			recoveryCode: 'ABCD-EFGH-JKLM',
		});

		render(<MemoriesCapture space={buildSpace('open')} maxSessionVideos={5} />);

		const nameInput = screen.getByLabelText(copy.displayNameLabel);
		expect(nameInput).toBeInTheDocument();
		expect(screen.queryByLabelText(copy.chooseFile)).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: copy.continueLabel })).toBeDisabled();

		await user.type(nameInput, PROFILE.displayName);
		await user.click(screen.getByRole('button', { name: copy.continueLabel }));

		expect(await screen.findByText('ABCD-EFGH-JKLM')).toBeInTheDocument();
		expect(guestApi.createSession).toHaveBeenCalledWith(PROFILE.displayName);
		expect(screen.getByText(copy.recoveryCodeTitle)).toBeInTheDocument();
		expect(screen.getByText(PROFILE.displayName)).toBeInTheDocument();
		expect(screen.getByLabelText(copy.chooseFile)).toBeEnabled();
		expect(guestApi.listItems).toHaveBeenCalled();
	});

	it('reserves, PUTs the file to the signed upload URL with the required headers, then completes', async () => {
		const user = userEvent.setup();
		const reservation = buildReservation();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockResolvedValue(reservation);
		guestApi.complete.mockResolvedValue({ item: buildItem({ status: 'accepted' }) });
		const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(200));

		render(<MemoriesCapture space={buildSpace('open')} maxSessionVideos={5} />);
		await screen.findByText(PROFILE.displayName);

		const file = pngFile();
		await user.upload(screen.getByLabelText(copy.chooseFile), file);
		expect(screen.getByText('familia.png')).toBeInTheDocument();
		expect(guestApi.reserve).not.toHaveBeenCalled();

		await user.click(screen.getByRole('button', { name: copy.confirmUpload }));

		expect(await screen.findByText(copy.success)).toBeInTheDocument();

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

	it('hides the upload panel when the window is closed while keeping the guest catalog', async () => {
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.listItems.mockResolvedValue({
			items: [buildItem({ id: 'accepted-item', status: 'accepted', caption: 'Familia' })],
			quota: QUOTA,
		});

		render(<MemoriesCapture space={buildSpace('closed')} maxSessionVideos={5} />);

		expect(await screen.findByRole('heading', { name: copy.myMemories })).toBeInTheDocument();
		expect(await screen.findByRole('img', { name: 'Familia' })).toHaveAttribute(
			'src',
			`/api/memories/${PUBLIC_SLUG}/items/accepted-item`,
		);
		expect(screen.getByText(PROFILE.displayName)).toBeInTheDocument();
		expect(screen.queryByLabelText(copy.chooseFile)).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: copy.confirmUpload })).not.toBeInTheDocument();
	});

	it('rejects an oversized image locally without reserving capacity', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(httpResponse(200));

		render(<MemoriesCapture space={buildSpace('open')} maxSessionVideos={5} />);
		await screen.findByText(PROFILE.displayName);

		const oversized = new File([new Uint8Array(MEMORIES_MAX_IMAGE_BYTES + 1)], 'grande.png', {
			type: 'image/png',
		});
		await user.upload(screen.getByLabelText(copy.chooseFile), oversized);
		await user.click(screen.getByRole('button', { name: copy.confirmUpload }));

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.fileTooLarge);
		expect(guestApi.reserve).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('maps a 429 reservation failure to the rate-limited copy', async () => {
		const user = userEvent.setup();
		guestApi.getSession.mockResolvedValue(PROFILE);
		guestApi.reserve.mockRejectedValue(new MemoriesRequestError(429, 'rate_limited'));

		render(<MemoriesCapture space={buildSpace('open')} maxSessionVideos={5} />);
		await screen.findByText(PROFILE.displayName);

		await user.upload(screen.getByLabelText(copy.chooseFile), pngFile('rapido.png'));
		await user.click(screen.getByRole('button', { name: copy.confirmUpload }));

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.rateLimited);
		expect(guestApi.reserve).toHaveBeenCalledTimes(1);
		expect(guestApi.complete).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: copy.retry })).toBeInTheDocument();
	});
});
