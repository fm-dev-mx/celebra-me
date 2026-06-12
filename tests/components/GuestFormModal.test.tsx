import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GuestFormModal from '@/components/dashboard/guests/GuestFormModal';
import { makeGuest } from '@tests/helpers/guest-factory';
import { MAX_CUSTOM_ATTENDEES } from '@/components/dashboard/guests/guest-form-constants';

jest.mock('@/components/dashboard/ModalShell', () => {
	return {
		__esModule: true,
		default: ({
			children,
			footer,
		}: {
			children: React.ReactNode;
			footer?: React.ReactNode;
			[key: string]: unknown;
		}) => (
			<div data-testid="modal-shell">
				<div data-testid="modal-content">{children}</div>
				{footer && <div data-testid="modal-footer">{footer}</div>}
			</div>
		),
	};
});

jest.mock('@/components/shared/PhoneInputGroup', () => {
	return {
		__esModule: true,
		default: (props: {
			id?: string;
			label?: string;
			error?: string;
			showOptional?: boolean;
			[key: string]: unknown;
		}) => (
			<div data-testid="phone-input-group">
				<label>{props.label}</label>
				{props.error && <span data-testid="phone-error">{props.error}</span>}
			</div>
		),
	};
});

function submitForm(): void {
	const form = document.getElementById('guest-form') as HTMLFormElement;
	fireEvent.submit(form);
}

describe('GuestFormModal — custom attendees', () => {
	const defaultProps = {
		open: true,
		mode: 'create' as const,
		initialGuest: null,
		onClose: jest.fn(),
		onSubmit: jest.fn().mockResolvedValue(undefined),
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders preset radios 1-5 and Otro button', () => {
		render(<GuestFormModal {...defaultProps} />);
		expect(screen.getByText('1')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('4')).toBeInTheDocument();
		expect(screen.getByText('5')).toBeInTheDocument();
		expect(screen.getByText('Otro')).toBeInTheDocument();
	});

	it('shows custom number input when Otro is selected', () => {
		render(<GuestFormModal {...defaultProps} />);
		fireEvent.click(screen.getByText('Otro'));
		const input = screen.getByRole('spinbutton');
		expect(input).toBeInTheDocument();
	});

	it('hides custom number input when a preset is clicked after Otro', () => {
		render(<GuestFormModal {...defaultProps} />);
		fireEvent.click(screen.getByText('Otro'));
		expect(screen.getByRole('spinbutton')).toBeInTheDocument();
		fireEvent.click(screen.getByText('3'));
		expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
	});

	it('renders the updated section title and helper text', () => {
		render(<GuestFormModal {...defaultProps} />);
		expect(screen.getByText('Número de pases')).toBeInTheDocument();
		expect(screen.getByText('Incluye al invitado principal.')).toBeInTheDocument();
	});

	it('shows error for empty custom input on submit', async () => {
		const onSubmit = jest.fn().mockResolvedValue(undefined);
		render(<GuestFormModal {...defaultProps} onSubmit={onSubmit} />);
		fireEvent.click(screen.getByText('Otro'));
		const input = screen.getByRole('spinbutton');
		fireEvent.change(input, { target: { value: '' } });
		submitForm();
		await waitFor(() => {
			expect(screen.getByText('Ingresa un número de pases.')).toBeInTheDocument();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('shows error for custom value 0 on submit', async () => {
		const onSubmit = jest.fn().mockResolvedValue(undefined);
		render(<GuestFormModal {...defaultProps} onSubmit={onSubmit} />);
		fireEvent.click(screen.getByText('Otro'));
		const input = screen.getByRole('spinbutton');
		fireEvent.change(input, { target: { value: '0' } });
		submitForm();
		await waitFor(() => {
			expect(screen.getByText('Ingresa un número de pases.')).toBeInTheDocument();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it(`shows error for custom value ${MAX_CUSTOM_ATTENDEES + 1} on submit`, async () => {
		const onSubmit = jest.fn().mockResolvedValue(undefined);
		render(<GuestFormModal {...defaultProps} onSubmit={onSubmit} />);
		fireEvent.click(screen.getByText('Otro'));
		const input = screen.getByRole('spinbutton');
		fireEvent.change(input, { target: { value: String(MAX_CUSTOM_ATTENDEES + 1) } });
		submitForm();
		await waitFor(() => {
			expect(screen.getByText(`Máximo ${MAX_CUSTOM_ATTENDEES} pases.`)).toBeInTheDocument();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('submits with custom value 7', async () => {
		const onSubmit = jest.fn().mockResolvedValue(undefined);
		render(<GuestFormModal {...defaultProps} onSubmit={onSubmit} />);
		const nameInput = document.getElementById('fullName') as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: 'Test Guest' } });
		fireEvent.click(screen.getByText('Otro'));
		const input = screen.getByRole('spinbutton');
		fireEvent.change(input, { target: { value: '7' } });
		submitForm();
		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({ maxAllowedAttendees: 7 }),
				expect.any(Boolean),
			);
		});
	});

	it('submits with custom value 15', async () => {
		const onSubmit = jest.fn().mockResolvedValue(undefined);
		render(<GuestFormModal {...defaultProps} onSubmit={onSubmit} />);
		const nameInput = document.getElementById('fullName') as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: 'Test Guest' } });
		fireEvent.click(screen.getByText('Otro'));
		const input = screen.getByRole('spinbutton');
		fireEvent.change(input, { target: { value: '15' } });
		submitForm();
		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({ maxAllowedAttendees: 15 }),
				expect.any(Boolean),
			);
		});
	});

	it('pre-selects Otro with populated value when editing a non-preset guest', () => {
		const guest = makeGuest({ maxAllowedAttendees: 10 });
		render(<GuestFormModal {...defaultProps} mode="edit" initialGuest={guest} />);
		const input = screen.getByRole('spinbutton');
		expect(input).toBeInTheDocument();
		expect(input).toHaveValue(10);
	});
});
