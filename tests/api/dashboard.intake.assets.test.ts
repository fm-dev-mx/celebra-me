import { POST as uploadPost } from '@/pages/api/dashboard/intake/[id]/assets/upload';
import { POST as importDemoPost } from '@/pages/api/dashboard/intake/[id]/assets/import-from-demo';
import { requireEditorMutationAccess } from '@/lib/intake/editor-api';
import { uploadAsset, importDemoAsset } from '@/lib/intake/services/asset.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { MAX_MULTIPART_BODY_BYTES } from '@/lib/intake/constants';
import { FormData as NodeFormData, Request as NodeRequest } from 'undici';

jest.mock('@/lib/intake/editor-api', () => ({
	requireEditorMutationAccess: jest.fn(),
	requireInvitationId: (id: string | undefined) => id ?? '',
}));

jest.mock('@/lib/intake/services/asset.service', () => ({
	uploadAsset: jest.fn(),
	importDemoAsset: jest.fn(),
}));

function createFormDataRequest(formData: NodeFormData): Request {
	return new NodeRequest('http://localhost/api/dashboard/intake/inv-1/assets/upload', {
		method: 'POST',
		body: formData,
	}) as unknown as Request;
}

const previousRequest = globalThis.Request;
beforeAll(() => {
	globalThis.Request = NodeRequest as unknown as typeof Request;
});
afterAll(() => {
	globalThis.Request = previousRequest;
});

describe('/api/dashboard/intake/[id]/assets API routes', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(requireEditorMutationAccess as jest.Mock).mockResolvedValue({ userId: 'admin-1' });
	});

	describe('POST /api/dashboard/intake/[id]/assets/upload', () => {
		it('returns 200 with asset metadata on successful image upload', async () => {
			const mockAsset = {
				id: 'asset-123',
				displayName: 'Foto Portada',
				width: 1200,
				height: 800,
				fileSize: 45000,
			};
			(uploadAsset as jest.Mock).mockResolvedValue({
				asset: mockAsset,
				src: 'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/test.webp',
			});

			const formData = new NodeFormData();
			const file = new Blob(['dummy-content'], { type: 'image/webp' });
			formData.append('file', file, 'upload.webp');
			formData.append('displayName', 'Foto Portada');

			const response = await uploadPost({
				request: createFormDataRequest(formData),
				cookies: {},
				params: { id: 'inv-1' },
			} as never);
			expect(response.status).toBe(200);
			const json = (await response.json()) as Record<string, unknown>;
			expect(json.assetId).toBe('asset-123');
			expect(json.src).toBe(
				'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/test.webp',
			);
			expect(json.width).toBe(1200);
			expect(json.height).toBe(800);
		});

		it('returns 400 when file is missing from formData', async () => {
			const formData = new NodeFormData();
			formData.append('displayName', 'Sin archivo');

			const response = await uploadPost({
				request: createFormDataRequest(formData),
				cookies: {},
				params: { id: 'inv-1' },
			} as never);

			expect(response.status).toBe(400);
			const json = (await response.json()) as { error: { message: string } };
			expect(json.error.message).toBe('No se envió ningún archivo.');
		});

		it('returns 400 when uploaded file is not an image', async () => {
			const formData = new NodeFormData();
			const file = new Blob(['text-content'], { type: 'application/pdf' });
			formData.append('file', file, 'upload.pdf');

			const response = await uploadPost({
				request: createFormDataRequest(formData),
				cookies: {},
				params: { id: 'inv-1' },
			} as never);

			expect(response.status).toBe(400);
			const json = (await response.json()) as { error: { message: string } };
			expect(json.error.message).toContain('Solo se aceptan imágenes');
		});

		it('rejects an oversized multipart body before parsing formData', async () => {
			const formData = new NodeFormData();
			formData.append('file', new Blob(['small'], { type: 'image/webp' }), 'upload.webp');
			const request = new NodeRequest(
				'http://localhost/api/dashboard/intake/inv-1/assets/upload',
				{
					method: 'POST',
					headers: { 'content-length': String(MAX_MULTIPART_BODY_BYTES + 1) },
					body: formData,
				},
			) as unknown as Request;

			const response = await uploadPost({
				request,
				cookies: {},
				params: { id: 'inv-1' },
			} as never);

			expect(response.status).toBe(413);
			expect(uploadAsset).not.toHaveBeenCalled();
		});

		it('returns 401 when user is not authorized', async () => {
			(requireEditorMutationAccess as jest.Mock).mockRejectedValueOnce(
				new ApiError(401, 'unauthorized', 'No autorizado.'),
			);

			const formData = new NodeFormData();
			const file = new Blob(['dummy'], { type: 'image/webp' });
			formData.append('file', file, 'upload.webp');

			const response = await uploadPost({
				request: createFormDataRequest(formData),
				cookies: {},
				params: { id: 'inv-1' },
			} as never);

			expect(response.status).toBe(401);
		});

		it('propagates 502 when storage provider encounters connection or config issues', async () => {
			(uploadAsset as jest.Mock).mockRejectedValueOnce(
				new ApiError(
					502,
					'config_error',
					'La carga de imágenes no está disponible en este momento.',
				),
			);

			const formData = new NodeFormData();
			const file = new Blob(['dummy'], { type: 'image/webp' });
			formData.append('file', file, 'upload.webp');

			const response = await uploadPost({
				request: createFormDataRequest(formData),
				cookies: {},
				params: { id: 'inv-1' },
			} as never);

			expect(response.status).toBe(502);
			const json = (await response.json()) as { error: { message: string } };
			expect(json.error.message).toBe(
				'La carga de imágenes no está disponible en este momento.',
			);
		});
	});

	describe('POST /api/dashboard/intake/[id]/assets/import-from-demo', () => {
		it('returns 200 on successful demo asset import', async () => {
			(importDemoAsset as jest.Mock).mockResolvedValue({
				asset: { id: 'demo-asset-1', displayName: 'hero' },
				src: 'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/demo.webp',
			});

			const request = new Request(
				'http://localhost/api/dashboard/intake/inv-1/assets/import-from-demo',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ demoKey: 'hero' }),
				},
			);

			const response = await importDemoPost({
				request,
				cookies: {},
				params: { id: 'inv-1' },
			} as never);

			expect(response.status).toBe(200);
			const json = (await response.json()) as Record<string, unknown>;
			expect(json.assetId).toBe('demo-asset-1');
			expect(json.src).toBe(
				'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/demo.webp',
			);
		});

		it('returns 400 when demoKey is missing', async () => {
			const request = new Request(
				'http://localhost/api/dashboard/intake/inv-1/assets/import-from-demo',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({}),
				},
			);

			const response = await importDemoPost({
				request,
				cookies: {},
				params: { id: 'inv-1' },
			} as never);

			expect(response.status).toBe(400);
			const json = (await response.json()) as { error: { message: string } };
			expect(json.error.message).toContain('No se especificó la clave de la imagen de demo');
		});
	});
});
