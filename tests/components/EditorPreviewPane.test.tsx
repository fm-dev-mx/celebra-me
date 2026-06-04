import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EditorPreviewPane from '@/components/dashboard/intake/editor/EditorPreviewPane';

describe('EditorPreviewPane', () => {
	const defaultProps = {
		invitationId: 'proj-1',
		hasUnsavedChanges: false,
		previewVersion: 0,
		previewHash: '',
		onReload: jest.fn(),
		paneRef: createRef<HTMLElement>(),
	};

	it('renders the saved-preview iframe and full preview link with embed mode', () => {
		render(<EditorPreviewPane {...defaultProps} />);

		expect(screen.getByRole('complementary', { name: 'Vista previa' })).toBeInTheDocument();
		expect(screen.getByText('Última versión guardada')).toBeInTheDocument();
		expect(screen.getByTitle('Vista previa de la invitación')).toHaveAttribute(
			'src',
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0',
		);
		expect(screen.getByRole('link', { name: 'Abrir vista completa' })).toHaveAttribute(
			'href',
			'/dashboard/invitaciones/proj-1/preview?v=0',
		);
		expect(screen.getByRole('link', { name: 'Abrir vista completa' })).toHaveAttribute(
			'target',
			'_blank',
		);
	});

	it('shows stale-preview copy when there are unsaved editor changes', () => {
		render(<EditorPreviewPane {...defaultProps} hasUnsavedChanges previewVersion={2} />);

		expect(screen.getByText('Hay cambios sin guardar')).toBeInTheDocument();
		expect(
			screen.getByText(
				'La vista previa muestra la última versión guardada. Los datos que editas aquí no se reflejarán hasta que guardes.',
			),
		).toBeInTheDocument();
	});

	it('includes preview hash in iframe src when provided', () => {
		render(<EditorPreviewPane {...defaultProps} previewHash="#quote-section" />);
		expect(screen.getByTitle('Vista previa de la invitación')).toHaveAttribute(
			'src',
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0#quote-section',
		);
	});

	it('does not include hash in iframe src when previewHash is empty', () => {
		render(<EditorPreviewPane {...defaultProps} previewHash="" />);
		expect(screen.getByTitle('Vista previa de la invitación')).toHaveAttribute(
			'src',
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0',
		);
	});

	it('switches device presets and reloads only the saved preview', () => {
		const onReload = jest.fn();
		render(<EditorPreviewPane {...defaultProps} previewVersion={1} onReload={onReload} />);

		expect(screen.getByRole('button', { name: 'Escritorio' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		fireEvent.click(screen.getByRole('button', { name: 'Móvil' }));
		expect(screen.getByRole('button', { name: 'Móvil' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(screen.getByTestId('editor-preview-frame')).toHaveAttribute('data-device', 'mobile');

		fireEvent.click(screen.getByRole('button', { name: 'Recargar' }));
		expect(onReload).toHaveBeenCalledTimes(1);
	});
});
