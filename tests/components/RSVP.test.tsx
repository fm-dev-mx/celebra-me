// tests/components/RSVP.test.tsx
// Component tests for the RSVP form

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RSVP from '@/components/invitation/RSVP';

describe('RSVP Component', () => {
	const defaultProps = {
		eventType: 'xv' as const,
		eventSlug: 'demo-xv',
		title: '¿Vienes a celebrar conmigo?',
		guestCap: 2,
		accessMode: 'personalized-only' as const,
		confirmationMessage: '¡Gracias por confirmar! Te esperamos con mucha emoción.',
		initialGuestData: {
			inviteId: 'mock-invite-id',
		},
	};

	beforeEach(() => {
		jest.clearAllMocks();
		window.HTMLElement.prototype.scrollIntoView = jest.fn();

		// Mock global fetch for API submissions
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ rsvpId: 'mock-rsvp-id' }),
			}),
		) as jest.Mock;
	});

	describe('Initial Render', () => {
		it('should render the title', () => {
			render(<RSVP {...defaultProps} />);

			expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
		});

		it('should render attendance radio buttons', () => {
			const { container } = render(<RSVP {...defaultProps} />);

			expect(screen.getByLabelText(/Sí, asistiré/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/No podré asistir/i)).toBeInTheDocument();
			expect(container.querySelectorAll('.rsvp__radio-indicator')).toHaveLength(2);
		});

		it('should render the confirm button', () => {
			render(<RSVP {...defaultProps} />);

			expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
		});

		it('should not show guest count field initially', () => {
			render(<RSVP {...defaultProps} />);

			expect(screen.queryByLabelText(/Número total de asistentes/i)).not.toBeInTheDocument();
		});

		it('shows a locked preview when no personalized inviteId is provided', async () => {
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="personalized-only"
					confirmationMessage="Gracias"
				/>,
			);

			await waitFor(() => {
				expect(screen.getByText(/utiliza enlaces personalizados/i)).toBeInTheDocument();
			});

			expect(screen.queryByRole('button', { name: /Confirmar/i })).not.toBeInTheDocument();
		});

		it('unlocks the form for hybrid public RSVP and requires the phone field', async () => {
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);

			expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
			expect(screen.getByLabelText(/Nombre completo/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Teléfono de contacto/i)).toBeInTheDocument();
			expect(screen.queryByText(/utiliza enlaces personalizados/i)).not.toBeInTheDocument();
		});
	});

	describe('Attendance Selection', () => {
		it('should show guest count field when "Yes" is selected', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			expect(screen.getByLabelText(/Número total de asistentes/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Sí, asistiré/i)).toBeChecked();
		});

		it('should mark the decline option as checked when selected', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/No podré asistir/i));

			expect(screen.getByLabelText(/No podré asistir/i)).toBeChecked();
			expect(screen.queryByLabelText(/Número total de asistentes/i)).not.toBeInTheDocument();
		});

		it('should show notes textarea when "Yes" is selected', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			expect(screen.getByLabelText(/Notas adicionales/i)).toBeInTheDocument();
		});

		it('should show error when confirm button is clicked without selection', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			const button = screen.getByRole('button', { name: /Confirmar/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByText(/Por favor, selecciona si asistirás/i)).toBeInTheDocument();
			});
		});

		it('should display max guest cap in the label', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			expect(
				screen.getByText(new RegExp(`Máx. ${defaultProps.guestCap}`)),
			).toBeInTheDocument();
		});
	});

	describe('Guest Cap Validation', () => {
		it('should show error when guest count exceeds cap', async () => {
			const user = userEvent.setup();
			const { container } = render(<RSVP {...defaultProps} />);

			// Select "Yes"
			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			// Fill name
			await user.type(screen.getByLabelText(/Nombre completo/i), 'Test User');

			// Set guest count above cap
			const guestInput = screen.getByLabelText(/Número total de asistentes/i);
			fireEvent.change(guestInput, { target: { value: '5' } });

			// Submit
			const form = container.querySelector('form');
			fireEvent.submit(form!);

			// Should show error
			await waitFor(() => {
				expect(screen.getByText(/El límite de invitados/i)).toBeInTheDocument();
			});
		});

		it('should not show error when guest count is within cap', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.type(screen.getByLabelText(/Nombre completo/i), 'Test User');

			const guestInput = screen.getByLabelText(/Número total de asistentes/i);
			await user.clear(guestInput);
			await user.type(guestInput, '2');

			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			// Should not show error, should show confirmation (which means no error was triggered)
			await waitFor(() => {
				expect(screen.queryByText(/El límite de invitados/i)).not.toBeInTheDocument();
			});
		});
	});

	describe('Form Submission', () => {
		it('should switch the submit button to loading before the request resolves', async () => {
			const user = userEvent.setup();
			let resolveFetch: ((value: unknown) => void) | undefined;
			global.fetch = jest.fn(
				() =>
					new Promise((resolve) => {
						resolveFetch = resolve;
					}),
			) as jest.Mock;

			const { container } = render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Nombre completo/i), 'Test User');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			const button = container.querySelector('.rsvp__button');
			expect(button).toHaveClass('rsvp__button--loading');

			resolveFetch?.({
				ok: true,
				json: async () => ({ rsvpId: 'mock-rsvp-id' }),
			});

			await waitFor(() => {
				expect(
					screen.getByText((content) => content.includes('¡Gracias por confirmar!')),
				).toBeInTheDocument();
			});
		});

		it('should show confirmation message on successful "Yes" submission', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Nombre completo/i), 'Test User');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(
					screen.getByText((content) => content.includes('¡Gracias por confirmar!')),
				).toBeInTheDocument();
			});
		});

		it('should show decline message on "No" submission', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Nombre completo/i), 'Test User');
			await user.click(screen.getByLabelText(/No podré asistir/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(
					screen.getByText(
						(content) =>
							content.includes('Sentimos mucho') && content.includes('no puedas'),
					),
				).toBeInTheDocument();
			});
		});

		it('should hide the form after submission', async () => {
			const user = userEvent.setup();
			const { container } = render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Nombre completo/i), 'Test User');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(container.querySelector('form')).not.toBeInTheDocument();
			});
		});
	});

	describe('Accessibility', () => {
		it('should have proper form structure', () => {
			const { container } = render(<RSVP {...defaultProps} />);

			const form = container.querySelector('form');
			expect(form).toBeInTheDocument();
		});

		it('should have associated labels for all inputs', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			expect(screen.getByLabelText(/Número total de asistentes/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Notas adicionales/i)).toBeInTheDocument();
		});
	});

	describe('Auto-focus on Errors', () => {
		it('should focus the name field if it is the first empty required field', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			const button = screen.getByRole('button', { name: /Confirmar/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByLabelText(/Nombre completo/i)).toHaveFocus();
			});
		});

		it('should focus the attendance radio if name is present but attendance is missing', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			const nameInput = screen.getByLabelText(/Nombre completo/i);
			await user.type(nameInput, 'Test User');

			const button = screen.getByRole('button', { name: /Confirmar/i });
			await user.click(button);

			await waitFor(() => {
				// The first radio button (Yes) should have focus
				expect(screen.getByLabelText(/Sí, asistiré/i)).toHaveFocus();
			});
		});
	});
});
