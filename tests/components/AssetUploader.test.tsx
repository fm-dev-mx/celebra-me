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

	it('rejects invalid file type client-side', async () => {
		const { container } = render(
			<AssetUploader invitationId="test-id" onUploaded={jest.fn()} />,
		);

		const input = getFileInput(container);
		expect(input).not.toBeNull();

		const file = createMockFile('doc.pdf', 'application/pdf', 1000);
		Object.defineProperty(input!, 'files', { value: [file] });
		fireEvent.change(input!);

		await waitFor(() => {
			expect(screen.getByText(/Tipo de archivo no soportado/i)).toBeInTheDocument();
		});
	});

	it('rejects oversized file client-side', async () => {
		const { container } = render(
			<AssetUploader invitationId="test-id" onUploaded={jest.fn()} />,
		);

		const input = getFileInput(container);
		expect(input).not.toBeNull();

		const file = createMockFile('large.webp', 'image/webp', 11 * 1024 * 1024);
		Object.defineProperty(input!, 'files', { value: [file] });
		fireEvent.change(input!);

		await waitFor(() => {
			expect(screen.getByText(/excede el tamaño máximo/i)).toBeInTheDocument();
		});
	});

	it('accepts valid file type client-side and calls callback', async () => {
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
});
