import { webcrypto } from 'node:crypto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';
import ValentinaMemoriesCapture from '@/components/memories/ValentinaMemoriesCapture';
import {
	calculateFileSha256Hex,
	createSecureClientRequestId,
} from '@/lib/memories/valentina-memories-client';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
if (!Blob.prototype.arrayBuffer) {
	Blob.prototype.arrayBuffer = function arrayBuffer(): Promise<ArrayBuffer> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as ArrayBuffer);
			reader.onerror = () => reject(reader.error);
			reader.readAsArrayBuffer(this);
		});
	};
}

const PROFILE = {
	displayName: 'Tía Ana',
	guestAlias: 'invitado-a1b2c3d4',
	expiresAt: '2026-09-28T00:00:00.000Z',
};

function response(payload: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => payload,
	} as Response;
}

describe('ValentinaMemoriesCapture', () => {
	beforeEach(() => {
		jest.restoreAllMocks();
	});

	it('requires a friendly one-step name before enabling phone capture', async () => {
		const user = userEvent.setup();
		const fetchMock = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(response({ error: { code: 'unauthorized' } }, 401))
			.mockResolvedValueOnce(response({ profile: PROFILE, recoveryCode: 'ABCD-EFGH-JKLM' }))
			.mockResolvedValueOnce(response({ items: [] }));

		render(<ValentinaMemoriesCapture />);
		const chooser = screen.getByLabelText(valentinaMemoriesCaptureCopy.chooseFile);
		expect(chooser).toBeDisabled();

		await user.type(screen.getByLabelText('Nombre o apodo'), PROFILE.displayName);
		await user.click(screen.getByRole('button', { name: 'Continuar' }));

		expect(await screen.findByText(new RegExp(PROFILE.guestAlias))).toBeInTheDocument();
		expect(screen.getByText('ABCD-EFGH-JKLM')).toBeInTheDocument();
		expect(chooser).toBeEnabled();
		expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/memories/valentina/session');
		expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
			action: 'create',
			displayName: PROFILE.displayName,
		});
	});

	it('reserves same-origin, PUTs directly with required headers, then completes', async () => {
		const user = userEvent.setup();
		const fetchMock = jest
			.spyOn(globalThis, 'fetch')
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url === '/api/memories/valentina/session') {
					return response({ profile: PROFILE });
				}
				if (url === '/api/memories/valentina/items' && init?.method === 'POST') {
					return response({
						item: {
							id: 'media-public-id',
							mimeType: 'image/jpeg',
							sizeBytes: 4,
							caption: '',
							status: 'uploading',
							createdAt: '2026-08-29T00:00:00.000Z',
						},
						upload: {
							uploadUrl: 'https://r2.example.invalid/capability',
							requiredHeaders: {
								'Content-Type': 'image/jpeg',
								'If-None-Match': '*',
								'x-amz-checksum-sha256': 'checksum',
							},
						},
					});
				}
				if (url === '/api/memories/valentina/items') {
					return response({ items: [] });
				}
				if (url === 'https://r2.example.invalid/capability') {
					return response(null, 412);
				}
				if (url === '/api/memories/valentina/items/media-public-id') {
					return response({ item: { status: 'accepted' } });
				}
				throw new Error(`Unexpected fetch: ${url}`);
			});

		const optimizeImage = jest.fn(
			async (candidate: File) =>
				new File([new Uint8Array([9, 8])], candidate.name, { type: candidate.type }),
		);
		render(<ValentinaMemoriesCapture optimizeImage={optimizeImage} />);
		await screen.findByText(new RegExp(PROFILE.guestAlias));
		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith('/api/memories/valentina/items', {
				headers: { Accept: 'application/json' },
			}),
		);
		fetchMock.mockClear();
		const file = new File([new Uint8Array([1, 2, 3, 4])], 'familia.jpg', {
			type: 'image/jpeg',
		});
		await user.upload(screen.getByLabelText(valentinaMemoriesCaptureCopy.chooseFile), file);

		await screen.findByText(valentinaMemoriesCaptureCopy.success);
		const reserveCall = fetchMock.mock.calls.find(
			([input, init]) =>
				input === '/api/memories/valentina/items' &&
				(init as RequestInit | undefined)?.method === 'POST',
		);
		expect(reserveCall?.[0]).toBe('/api/memories/valentina/items');
		const reserveBody = JSON.parse(String((reserveCall?.[1] as RequestInit).body));
		expect(reserveBody).toMatchObject({
			action: 'reserve',
			mimeType: 'image/jpeg',
			sizeBytes: 2,
		});
		expect(optimizeImage).toHaveBeenCalledTimes(1);
		expect(reserveBody.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
		expect(reserveBody.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
		expect(reserveBody.objectKey).toBeUndefined();

		const putCall = fetchMock.mock.calls.find(
			([input]) => input === 'https://r2.example.invalid/capability',
		);
		expect(putCall?.[0]).toBe('https://r2.example.invalid/capability');
		expect(putCall?.[1]).toMatchObject({
			method: 'PUT',
			headers: {
				'Content-Type': 'image/jpeg',
				'If-None-Match': '*',
				'x-amz-checksum-sha256': 'checksum',
			},
		});
		expect((putCall?.[1] as RequestInit).body).toBeInstanceOf(File);
		expect(((putCall?.[1] as RequestInit).body as File).size).toBe(2);
		expect(
			fetchMock.mock.calls.some(
				([input]) => input === '/api/memories/valentina/items/media-public-id',
			),
		).toBe(true);
	});

	it('hashes incrementally and creates opaque request identifiers with Web Crypto', async () => {
		const blob = new Blob([new Uint8Array([1, 2, 3, 4])]);
		await expect(calculateFileSha256Hex(blob)).resolves.toBe(
			'9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a',
		);
		expect(createSecureClientRequestId()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
	});

	it('lets the guest cancel image optimization before a reservation exists', async () => {
		const user = userEvent.setup();
		const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			if (input === '/api/memories/valentina/session') return response({ profile: PROFILE });
			if (input === '/api/memories/valentina/items') return response({ items: [] });
			throw new Error(`Unexpected fetch: ${String(input)}`);
		});
		let wasAborted = false;
		const optimizeImage = jest.fn(
			(_candidate: File, signal?: AbortSignal) =>
				new Promise<File>((_resolve, reject) => {
					signal?.addEventListener('abort', () => {
						wasAborted = true;
						reject(new DOMException('aborted', 'AbortError'));
					});
				}),
		);
		render(<ValentinaMemoriesCapture optimizeImage={optimizeImage} />);
		await screen.findByText(new RegExp(PROFILE.guestAlias));
		const chooser = screen.getByLabelText(valentinaMemoriesCaptureCopy.chooseFile);
		await user.upload(
			chooser,
			new File([new Uint8Array([1, 2, 3])], 'foto.jpg', { type: 'image/jpeg' }),
		);
		await user.click(
			await screen.findByRole('button', {
				name: valentinaMemoriesCaptureCopy.cancelOptimization,
			}),
		);
		await waitFor(() => expect(chooser).toBeEnabled());
		expect(wasAborted).toBe(true);
		expect(
			fetchMock.mock.calls.some(([, init]) =>
				String((init as RequestInit | undefined)?.body).includes('"sizeBytes":3'),
			),
		).toBe(false);
	});

	it('never renders storage keys or signed URLs in the guest surface', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ error: {} }, 401));
		render(<ValentinaMemoriesCapture />);
		await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
		expect(document.body.textContent).not.toMatch(/events\/valentina|X-Amz-|objectKey/i);
	});
});
