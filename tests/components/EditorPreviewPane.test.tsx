import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EditorPreviewPane, {
	getPreviewScale,
} from '@/components/dashboard/intake/editor/EditorPreviewPane';

describe('getPreviewScale', () => {
	it('returns 1 when available width is 0 or negative', () => {
		expect(getPreviewScale(0, 1280)).toBe(1);
		expect(getPreviewScale(-1, 1280)).toBe(1);
	});

	it('returns 1 when virtual width is 0 or negative', () => {
		expect(getPreviewScale(800, 0)).toBe(1);
		expect(getPreviewScale(800, -1)).toBe(1);
	});

	it('returns 1 when virtual width fits within available width', () => {
		expect(getPreviewScale(1280, 1280)).toBe(1);
		expect(getPreviewScale(1400, 1280)).toBe(1);
	});

	it('returns scale < 1 when virtual width exceeds available width', () => {
		expect(getPreviewScale(640, 1280)).toBe(0.5);
		expect(getPreviewScale(390, 1280)).toBeCloseTo(0.3047, 3);
	});

	it('respects maxScale parameter', () => {
		expect(getPreviewScale(1500, 1280, 0.8)).toBe(1);
		expect(getPreviewScale(640, 1280, 0.8)).toBe(0.5);
	});

	it('returns exact ratio when virtual width is larger', () => {
		const result = getPreviewScale(768, 1280);
		expect(result).toBe(768 / 1280);
	});
});

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
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0&revealState=internal',
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
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0&revealState=internal#quote-section',
		);
	});

	it('does not include hash in iframe src when previewHash is empty', () => {
		render(<EditorPreviewPane {...defaultProps} previewHash="" />);
		expect(screen.getByTitle('Vista previa de la invitación')).toHaveAttribute(
			'src',
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0&revealState=internal',
		);
	});

	it('switches reveal preview states for the embedded iframe', () => {
		render(<EditorPreviewPane {...defaultProps} />);

		expect(screen.getByRole('button', { name: 'Interior' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);

		fireEvent.click(screen.getByRole('button', { name: 'Sobre' }));
		expect(screen.getByTitle('Vista previa de la invitación')).toHaveAttribute(
			'src',
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0&revealState=closed',
		);

		fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
		expect(screen.getByTitle('Vista previa de la invitación')).toHaveAttribute(
			'src',
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0&revealState=opened',
		);
	});

	it('defaults to mobile viewport on first render', () => {
		render(<EditorPreviewPane {...defaultProps} />);

		expect(screen.getByRole('button', { name: 'Móvil' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(screen.getByTestId('editor-preview-frame')).toHaveAttribute('data-device', 'mobile');
	});

	it('switches from mobile to desktop and back', () => {
		render(<EditorPreviewPane {...defaultProps} />);

		expect(screen.getByRole('button', { name: 'Móvil' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		fireEvent.click(screen.getByRole('button', { name: 'Escritorio' }));
		expect(screen.getByRole('button', { name: 'Escritorio' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(screen.getByTestId('editor-preview-frame')).toHaveAttribute(
			'data-device',
			'desktop',
		);

		fireEvent.click(screen.getByRole('button', { name: 'Tableta' }));
		expect(screen.getByRole('button', { name: 'Tableta' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(screen.getByTestId('editor-preview-frame')).toHaveAttribute('data-device', 'tablet');
	});

	it('defaults to mobile viewport width on initial render', () => {
		render(<EditorPreviewPane {...defaultProps} />);
		const iframe = screen.getByTitle('Vista previa de la invitación');
		expect(iframe).toHaveAttribute('width', '390');
	});

	it('switches to desktop viewport width when desktop tab is clicked', () => {
		render(<EditorPreviewPane {...defaultProps} />);
		fireEvent.click(screen.getByRole('button', { name: 'Escritorio' }));
		const iframe = screen.getByTitle('Vista previa de la invitación');
		expect(iframe).toHaveAttribute('width', '1440');
	});

	it('switches to tablet viewport width when tablet tab is clicked', () => {
		render(<EditorPreviewPane {...defaultProps} />);
		fireEvent.click(screen.getByRole('button', { name: 'Tableta' }));
		const iframe = screen.getByTitle('Vista previa de la invitación');
		expect(iframe).toHaveAttribute('width', '768');
	});

	it('renders viewport wrapper with mobile --vp-width custom property by default', () => {
		render(<EditorPreviewPane {...defaultProps} />);
		const viewport = document.querySelector('.invitation-editor__preview-viewport');
		expect(viewport).toBeInTheDocument();
		expect(viewport).toHaveStyle('--vp-width: 390px');
	});
});
