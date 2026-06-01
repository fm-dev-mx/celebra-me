import { render, screen, fireEvent } from '@testing-library/react';
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
	});

	it('applies danger class when destructive is true', () => {
		render(<ConfirmModal {...defaultProps} destructive />);

		const confirmButton = screen.getByText('Confirmar');
		expect(confirmButton.className).toContain('btn-primary--danger');
	});
});
