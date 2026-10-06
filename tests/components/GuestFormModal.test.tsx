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

describe('GuestFormModal — party size stepper', () => {
	const defaultProps = {
		open: true,
		mode: 'create' as const,
		initialGuest: null,
		onClose: jest.fn(),
		onSubmit: jest.fn().mockResolvedValue(undefined),
	};

	const peopleInput = () => screen.getByLabelText('¿Cuántas personas vienen?');

	function fillName(): void {
		fireEvent.change(document.getElementById('fullName') as HTMLInputElement, {
			target: { value: 'Test Guest' },
		});
	}

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('starts at one person and explains who counts', () => {
		render(<GuestFormModal {...defaultProps} />);
		expect(peopleInput()).toHaveValue(1);
		expect(screen.getByText('Incluya al invitado principal.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Una persona menos' })).toBeDisabled();
	});

	it('adds and removes people with the large buttons', () => {
		render(<GuestFormModal {...defaultProps} />);
		fireEvent.click(screen.getByRole('button', { name: 'Una persona más' }));
		fireEvent.click(screen.getByRole('button', { name: 'Una persona más' }));
		expect(peopleInput()).toHaveValue(3);
		fireEvent.click(screen.getByRole('button', { name: 'Una persona menos' }));
		expect(peopleInput()).toHaveValue(2);
	});

	it.each([
		['', 'Escriba cuántas personas vienen.'],
		['0', 'Escriba cuántas personas vienen.'],
		[String(MAX_CUSTOM_ATTENDEES + 1), `El máximo es ${MAX_CUSTOM_ATTENDEES} personas.`],
	])('rejects %p on submit', async (value, message) => {
		const onSubmit = jest.fn().mockResolvedValue(undefined);
		render(<GuestFormModal {...defaultProps} onSubmit={onSubmit} />);
		fillName();
		fireEvent.change(peopleInput(), { target: { value } });
		submitForm();
		await waitFor(() => {
			expect(screen.getByText(message)).toBeInTheDocument();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it.each([7, 15])('submits a typed party size of %i', async (size) => {
		const onSubmit = jest.fn().mockResolvedValue(undefined);
		render(<GuestFormModal {...defaultProps} onSubmit={onSubmit} />);
		fillName();
		fireEvent.change(peopleInput(), { target: { value: String(size) } });
		submitForm();
		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({ maxAllowedAttendees: size }),
				expect.any(Boolean),
			);
		});
	});

	it('loads the saved party size when editing', () => {
		const guest = makeGuest({ maxAllowedAttendees: 10 });
		render(<GuestFormModal {...defaultProps} mode="edit" initialGuest={guest} />);
		expect(peopleInput()).toHaveValue(10);
	});
});
