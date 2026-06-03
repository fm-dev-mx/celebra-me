import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssetUploader from '@/components/dashboard/intake/editor/AssetUploader';

function createMockFile(name: string, type: string, size: number): File {
	const blob = new Blob(['x'.repeat(size)], { type });
	return new File([blob], name, { type });
}

function getFileInput(container: HTMLElement): HTMLInputElement | null {
	return container.querySelector('input[type="file"]');
}

beforeEach(() => {
	jest.restoreAllMocks();
});

describe('AssetUploader', () => {
	it('shows the dropzone label', () => {
		render(<AssetUploader invitationId="test-id" onUploaded={jest.fn()} />);
		expect(
			screen.getByText('Arrastra imágenes aquí o haz clic para subir'),
		).toBeInTheDocument();
	});

	it('rejects invalid file type with Spanish message', async () => {
		const { container } = render(
			<AssetUploader invitationId="test-id" onUploaded={jest.fn()} />,
		);

		const input = getFileInput(container);
		expect(input).not.toBeNull();

		const file = createMockFile('doc.pdf', 'application/pdf', 1000);
		Object.defineProperty(input!, 'files', { value: [file] });
		fireEvent.change(input!);

		await waitFor(() => {
			expect(
				screen.getByText('Solo se permiten imágenes JPG, PNG o WebP.'),
			).toBeInTheDocument();
		});
	});

	it('rejects oversized file with Spanish message', async () => {
		const { container } = render(
			<AssetUploader invitationId="test-id" onUploaded={jest.fn()} />,
		);

		const input = getFileInput(container);
		expect(input).not.toBeNull();

		const file = createMockFile('large.webp', 'image/webp', 11 * 1024 * 1024);
		Object.defineProperty(input!, 'files', { value: [file] });
		fireEvent.change(input!);

		await waitFor(() => {
			expect(screen.getByText('La imagen supera el límite de 10 MB.')).toBeInTheDocument();
		});
	});

	it('accepts valid file and calls callback', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assetId: 'new-asset-id', src: 'https://cdn.test/new.webp' }),
		} as Response);

		const onUploaded = jest.fn();
		const { container } = render(
			<AssetUploader invitationId="test-id" onUploaded={onUploaded} />,
		);

		const input = getFileInput(container);
		expect(input).not.toBeNull();

		const file = createMockFile('photo.webp', 'image/webp', 500 * 1024);
		Object.defineProperty(input!, 'files', { value: [file] });
		fireEvent.change(input!);

		await waitFor(() => {
			expect(screen.getByText('Subiendo imagen...')).toBeInTheDocument();
		});

		await waitFor(() => {
			expect(onUploaded).toHaveBeenCalled();
		});
	});

	it('shows server-error message in Spanish when API rejects upload', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: false,
			json: async () => ({ error: { message: 'Tipo de archivo no soportado.' } }),
		} as Response);

		const onUploaded = jest.fn();
		const { container } = render(
			<AssetUploader invitationId="test-id" onUploaded={onUploaded} />,
		);

		const input = getFileInput(container);
		expect(input).not.toBeNull();

		const file = createMockFile('photo.webp', 'image/webp', 500 * 1024);
		Object.defineProperty(input!, 'files', { value: [file] });
		fireEvent.change(input!);

		await waitFor(() => {
			expect(screen.getByText('Tipo de archivo no soportado.')).toBeInTheDocument();
		});
		expect(onUploaded).not.toHaveBeenCalled();
	});

	it('shows Spanish message for network failures', async () => {
		jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

		const { container } = render(
			<AssetUploader invitationId="test-id" onUploaded={jest.fn()} />,
		);

		const input = getFileInput(container);
		expect(input).not.toBeNull();

		const file = createMockFile('photo.webp', 'image/webp', 500 * 1024);
		Object.defineProperty(input!, 'files', { value: [file] });
		fireEvent.change(input!);

		await waitFor(() => {
			expect(
				screen.getByText('No se pudo subir la imagen. Intenta nuevamente.'),
			).toBeInTheDocument();
		});
	});

	it('shows Spanish message for malformed API response', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => {
				throw new SyntaxError('bad json');
			},
		} as unknown as Response);

		const { container } = render(
			<AssetUploader invitationId="test-id" onUploaded={jest.fn()} />,
		);

		const input = getFileInput(container);
		expect(input).not.toBeNull();

		const file = createMockFile('photo.webp', 'image/webp', 500 * 1024);
		Object.defineProperty(input!, 'files', { value: [file] });
		fireEvent.change(input!);

		await waitFor(() => {
			expect(
				screen.getByText('La respuesta del servidor no fue válida.'),
			).toBeInTheDocument();
		});
	});

	it('prevents duplicate uploads while a request is pending', async () => {
		const fetchSpy = jest
			.spyOn(globalThis, 'fetch')
			.mockImplementation(() => new Promise<Response>(() => undefined) as never);

		const { container } = render(
			<AssetUploader invitationId="test-id" onUploaded={jest.fn()} />,
		);

		const input = getFileInput(container);
		expect(input).not.toBeNull();

		const fileA = createMockFile('a.webp', 'image/webp', 1000);
		Object.defineProperty(input!, 'files', { value: [fileA] });
		fireEvent.change(input!);

		await waitFor(() => {
			expect(screen.getByText('Subiendo imagen...')).toBeInTheDocument();
		});

		expect(input!.disabled).toBe(true);

		fetchSpy.mockClear();

		fireEvent.change(input!);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
