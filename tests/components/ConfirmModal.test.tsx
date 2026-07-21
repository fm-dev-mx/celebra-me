import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';

describe('ConfirmModal', () => {
	const defaultProps = {
		title: 'Confirmar acción',
		message: '¿Estás seguro?',
		confirmLabel: 'Confirmar',
		onConfirm: jest.fn(),
		onCancel: jest.fn(),
	};

	it('renders title and message', () => {
		render(<ConfirmModal {...defaultProps} />);

		expect(screen.getByText('Confirmar acción')).toBeInTheDocument();
		expect(screen.getByText('¿Estás seguro?')).toBeInTheDocument();
	});

	it('calls onConfirm when confirm button is clicked', () => {
		render(<ConfirmModal {...defaultProps} />);

		fireEvent.click(screen.getByText('Confirmar'));
		expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
	});

	it('calls onCancel when cancel button is clicked', () => {
		render(<ConfirmModal {...defaultProps} />);

		fireEvent.click(screen.getByText('Cancelar'));
		expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
	});

	it('shows loading state and disables buttons', () => {
		render(<ConfirmModal {...defaultProps} loading />);

		expect(screen.getByText('Procesando...')).toBeInTheDocument();
		expect(screen.getByText('Procesando...')).toBeDisabled();
		expect(screen.getByText('Cancelar')).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Cerrar modal' })).toBeDisabled();
	});

	it('moves focus to the dialog heading and closes with Escape when idle', async () => {
		const onCancel = jest.fn();
		render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);

		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Confirmar acción' })).toHaveFocus(),
		);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('announces publication feedback inside the active dialog', () => {
		render(
			<ConfirmModal
				{...defaultProps}
				feedback={{
					state: 'error',
					message: 'El borrador cambió antes de terminar la publicación.',
					guidance: 'Recarga el editor antes de volver a publicar.',
					retryable: false,
				}}
			/>,
		);

		expect(screen.getByRole('alert')).toHaveTextContent(
			'El borrador cambió antes de terminar la publicación.',
		);
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Recarga el editor antes de volver a publicar.',
		);
	});

	it('does not close with Escape while processing', () => {
		const onCancel = jest.fn();
		render(<ConfirmModal {...defaultProps} onCancel={onCancel} loading />);

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('applies danger class when destructive is true', () => {
		render(<ConfirmModal {...defaultProps} destructive />);

		const confirmButton = screen.getByText('Confirmar');
		expect(confirmButton.className).toContain('btn-primary--danger');
	});
});
