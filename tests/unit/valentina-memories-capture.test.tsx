import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ValentinaMemoriesCapture from '@/components/memories/ValentinaMemoriesCapture';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';
import {
	VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	VALENTINA_MEMORIES_PRODUCTION_SIGN_URL,
	VALENTINA_MEMORIES_SIGN_PATH,
} from '@/data/valentina-memories-upload.contract';
import { webcrypto } from 'node:crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

import {
	resolveValentinaMemoriesSignUrl,
	validateValentinaMemoriesFile,
} from '@/lib/memories/valentina-memories-client';

const SIGN_URL = VALENTINA_MEMORIES_PRODUCTION_SIGN_URL;
const PUT_URL = 'https://r2-stub.test/put';

function makeFile(name: string, type: string, sizeBytes: number): File {
	return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('valentina memories capture client', () => {
	it('resolves only an explicit sign URL with the contracted path', () => {
		expect(resolveValentinaMemoriesSignUrl(SIGN_URL)).toBe(SIGN_URL);
		expect(
			resolveValentinaMemoriesSignUrl(`http://127.0.0.1:8787${VALENTINA_MEMORIES_SIGN_PATH}`),
		).toBe(`http://127.0.0.1:8787${VALENTINA_MEMORIES_SIGN_PATH}`);
		expect(resolveValentinaMemoriesSignUrl('')).toBeNull();
		expect(resolveValentinaMemoriesSignUrl('https://www.celebra-me.com/api/upload')).toBeNull();
		expect(
			resolveValentinaMemoriesSignUrl('https://memories.celebra-me.com/sign/other'),
		).toBeNull();
		expect(resolveValentinaMemoriesSignUrl('https://example.com/sign/valentina')).toBeNull();
		expect(resolveValentinaMemoriesSignUrl(`${SIGN_URL}?redirect=1`)).toBeNull();
	});

	it('normalizes the signed MIME value used by the JSON request and direct PUT', async () => {
		const user = userEvent.setup();
		jest.spyOn(global, 'fetch')
			.mockClear()
			.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
				if (String(input) === SIGN_URL) {
					expect(JSON.parse(String(init?.body))).toMatchObject({
						mimeType: 'image/jpeg',
					});
					return {
						ok: true,
						json: async () => ({ uploadUrl: PUT_URL }),
					} as Response;
				}

				expect(new Headers(init?.headers).get('Content-Type')).toBe('image/jpeg');
				return { ok: true } as Response;
			});

		render(<ValentinaMemoriesCapture signUrl={SIGN_URL} />);
		await user.upload(
			screen.getByLabelText(valentinaMemoriesCaptureCopy.chooseFile),
			makeFile('foto.jpg', 'IMAGE/JPEG', 8),
		);

		expect(await screen.findByText(valentinaMemoriesCaptureCopy.success)).toBeInTheDocument();
	});

	it('validates MIME and size from the shared contract', () => {
		expect(validateValentinaMemoriesFile(makeFile('ok.jpg', 'image/jpeg', 1024))).toBeNull();
		expect(
			validateValentinaMemoriesFile(makeFile('clip.mp4', 'video/mp4', 8 * 1024 * 1024)),
		).toBeNull();
		expect(validateValentinaMemoriesFile(makeFile('notes.pdf', 'application/pdf', 1024))).toBe(
			'unsupported_type',
		);
		const oversized = makeFile('huge.jpg', 'image/jpeg', 8);
		Object.defineProperty(oversized, 'size', { value: VALENTINA_MEMORIES_MAX_IMAGE_BYTES + 1 });
		expect(validateValentinaMemoriesFile(oversized)).toBe('file_too_large');
	});

	it('fails closed when the sign URL is missing', () => {
		render(<ValentinaMemoriesCapture signUrl={null} />);

		expect(screen.getByRole('status')).toHaveTextContent(
			valentinaMemoriesCaptureCopy.unavailable,
		);
		expect(
			screen.queryByLabelText(valentinaMemoriesCaptureCopy.chooseFile),
		).not.toBeInTheDocument();
	});

	it('rejects an over-60-second video before signing', async () => {
		const user = userEvent.setup();
		const fetchMock = jest.spyOn(global, 'fetch');
		fetchMock.mockClear();

		render(
			<ValentinaMemoriesCapture
				signUrl={SIGN_URL}
				readVideoDurationSeconds={async () => 61}
			/>,
		);

		await user.upload(
			screen.getByLabelText(valentinaMemoriesCaptureCopy.chooseFile),
			makeFile('clip.mp4', 'video/mp4', 1024),
		);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			valentinaMemoriesCaptureCopy.videoTooLong,
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('posts the expected sign payload and shows confirmation after PUT', async () => {
		const user = userEvent.setup();
		jest.spyOn(global, 'fetch')
			.mockClear()
			.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url === SIGN_URL) {
					expect(init?.method).toBe('POST');
					const body = JSON.parse(String(init?.body));
					expect(body.mimeType).toBe('image/jpeg');
					expect(body.sizeBytes).toBe(8);
					expect(body.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
					return {
						ok: true,
						json: async () => ({
							uploadUrl: PUT_URL,
							objectKey: 'events/valentina/secret.jpg',
							expiresAt: '2026-08-29T21:50:00.000Z',
						}),
					} as Response;
				}

				expect(url).toBe(PUT_URL);
				expect(init?.method).toBe('PUT');
				expect(new Headers(init?.headers).get('Content-Type')).toBe('image/jpeg');
				return { ok: true } as Response;
			});

		render(<ValentinaMemoriesCapture signUrl={SIGN_URL} />);
		await user.upload(
			screen.getByLabelText(valentinaMemoriesCaptureCopy.chooseFile),
			makeFile('foto.jpg', 'image/jpeg', 8),
		);

		expect(await screen.findByText(valentinaMemoriesCaptureCopy.success)).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: valentinaMemoriesCaptureCopy.uploadAnother }),
		).toBeInTheDocument();
		expect(screen.queryByText(/events\/valentina/)).not.toBeInTheDocument();
		expect(screen.queryByText(/r2-stub/)).not.toBeInTheDocument();
		expect(screen.queryByText(/objectKey/i)).not.toBeInTheDocument();
	});

	it('keeps a failed sign retryable without reload', async () => {
		const user = userEvent.setup();
		const fetchMock = jest
			.spyOn(global, 'fetch')
			.mockClear()
			.mockResolvedValueOnce({
				ok: false,
				status: 403,
				json: async () => ({ error: { code: 'upload_window_closed' } }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					uploadUrl: PUT_URL,
					objectKey: 'events/valentina/retry.jpg',
					expiresAt: '2026-08-29T21:50:00.000Z',
				}),
			} as Response)
			.mockResolvedValueOnce({ ok: true } as Response);

		render(<ValentinaMemoriesCapture signUrl={SIGN_URL} />);
		await user.upload(
			screen.getByLabelText(valentinaMemoriesCaptureCopy.chooseFile),
			makeFile('foto.jpg', 'image/jpeg', 8),
		);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			valentinaMemoriesCaptureCopy.windowClosed,
		);

		await user.click(screen.getByRole('button', { name: valentinaMemoriesCaptureCopy.retry }));

		await waitFor(() => {
			expect(screen.getByText(valentinaMemoriesCaptureCopy.success)).toBeInTheDocument();
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});
