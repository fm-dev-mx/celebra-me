// tests/components/RSVP.test.tsx
// Component tests for the RSVP form

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RSVP from '@/components/invitation/RSVP';

describe('RSVP Component', () => {
	const defaultProps = {
		eventType: 'xv' as const,
		eventSlug: 'demo-xv-jewelry-box',
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

		// Mock global fetch for API submissions using spy so tests can
		// override via mockImplementationOnce without cross-test leakage.
		jest.spyOn(global, 'fetch').mockImplementation(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ rsvpId: 'mock-rsvp-id' }),
			} as Response),
		);
	});

	describe('Initial Render', () => {
		it('should render the title', () => {
			render(<RSVP {...defaultProps} />);

			expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
		});

		it('should render custom subcopy when provided', () => {
			render(<RSVP {...defaultProps} subcopy="Texto personalizado para esta celebración." />);

			expect(
				screen.getByText('Texto personalizado para esta celebración.'),
			).toBeInTheDocument();
		});

		it('should render default subcopy based on eventType when omitted', () => {
			render(<RSVP {...defaultProps} />);

			expect(
				screen.getByText(
					'Tu respuesta nos ayuda a preparar cada detalle de esta celebración especial.',
				),
			).toBeInTheDocument();
		});

		it('should render subcopy element even with whitespace-only value', () => {
			const { container } = render(<RSVP {...defaultProps} subcopy=" " />);

			const subcopyEl = container.querySelector('.rsvp__subcopy');
			expect(subcopyEl).toBeInTheDocument();
			expect(subcopyEl?.textContent).toBe(' ');
		});

		it('should render attendance radio buttons', () => {
			const { container } = render(<RSVP {...defaultProps} />);

			expect(screen.getByLabelText(/Sí, asistiré/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/No podré/i)).toBeInTheDocument();
			expect(container.querySelectorAll('.rsvp__radio-indicator')).toHaveLength(2);
		});

		it('should render the confirm button', () => {
			render(<RSVP {...defaultProps} />);

			expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
		});

		it('should not show guest count field initially', () => {
			render(<RSVP {...defaultProps} />);

			expect(screen.queryByLabelText(/Número de asistentes/i)).not.toBeInTheDocument();
		});

		it('shows a locked preview when no personalized inviteId is provided', async () => {
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="personalized-only"
					confirmationMessage="Gracias"
				/>,
			);

			await waitFor(() => {
				expect(screen.getByText(/Si recibiste tu invitación directa/i)).toBeInTheDocument();
			});

			expect(screen.queryByRole('button', { name: /Confirmar/i })).not.toBeInTheDocument();
		});

		it('unlocks the form for hybrid public RSVP', () => {
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);

			expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
			expect(screen.queryByText(/utiliza enlaces personalizados/i)).not.toBeInTheDocument();
		});

		it('public RSVP initial state does not render name field', () => {
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);
			expect(screen.queryByLabelText(/Tu nombre/i)).not.toBeInTheDocument();
		});

		it('public RSVP initial state does not render phone field', () => {
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);
			expect(screen.queryByLabelText(/Teléfono de contacto/i)).not.toBeInTheDocument();
		});

		it('public RSVP initial state does not render country code selector', () => {
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);
			expect(
				screen.queryByRole('combobox', { name: /código de país/i }),
			).not.toBeInTheDocument();
		});

		it('public RSVP selecting "Sí, asistiré" renders name field', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			expect(screen.getByLabelText(/Tu nombre/i)).toBeInTheDocument();
		});

		it('public RSVP selecting "Sí, asistiré" renders phone field', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			expect(screen.getByLabelText(/Teléfono de contacto/i)).toBeInTheDocument();
		});

		it('public RSVP selecting "No podré" renders name field', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);
			await user.click(screen.getByLabelText(/No podré/i));
			expect(screen.getByLabelText(/Tu nombre/i)).toBeInTheDocument();
		});

		it('public RSVP selecting "No podré" renders phone field', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);
			await user.click(screen.getByLabelText(/No podré/i));
			expect(screen.getByLabelText(/Teléfono de contacto/i)).toBeInTheDocument();
		});

		const demoProps = {
			eventType: 'xv' as const,
			eventSlug: 'demo-xv-editorial',
			title: 'Confirma tu asistencia',
			guestCap: 4,
			accessMode: 'personalized-only' as const,
			confirmationMessage: 'Gracias por confirmar.',
			isDemoPreview: true,
		};

		it('renders RSVP form for demo preview mode regardless of accessMode', async () => {
			render(<RSVP {...demoProps} />);

			await waitFor(() => {
				expect(
					screen.queryByText(/utiliza enlaces personalizados/i),
				).not.toBeInTheDocument();
			});
			expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
			expect(screen.getByText(/Demo interactiva/)).toBeInTheDocument();
		});

		it('shows success state in demo preview mode after form submission', async () => {
			const user = userEvent.setup();
			render(<RSVP {...demoProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(screen.getByText(/Gracias por acompañarnos/i)).toBeInTheDocument();
			});
		});
	});

	describe('Attendance Selection', () => {
		it('should show guest count field when "Yes" is selected', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			expect(screen.getByLabelText(/Número de asistentes/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Sí, asistiré/i)).toBeChecked();
		});

		it('"Sí, asistiré" shows attendee count with value 1', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} guestCap={10} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			const guestInput = screen.getByLabelText(/Número de asistentes/i) as HTMLInputElement;
			expect(guestInput.value).toBe('1');
		});

		it('should mark the decline option as checked when selected', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/No podré/i));

			expect(screen.getByLabelText(/No podré/i)).toBeChecked();
			// Guest count should still be hidden
			expect(screen.queryByLabelText(/Número de asistentes/i)).not.toBeInTheDocument();
			// Notes should now be visible
			expect(screen.getByLabelText(/Mensaje para el festejado/i)).toBeInTheDocument();
		});

		it('"No podré" hides attendee count', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			expect(screen.getByLabelText(/Número de asistentes/i)).toBeInTheDocument();

			await user.click(screen.getByLabelText(/No podré/i));
			expect(screen.queryByLabelText(/Número de asistentes/i)).not.toBeInTheDocument();
		});

		it('switching "No podré" to "Sí, asistiré" resets attendee count to 1', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} guestCap={10} />);

			await user.click(screen.getByLabelText(/No podré/i));
			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			const guestInput = screen.getByLabelText(/Número de asistentes/i) as HTMLInputElement;
			expect(guestInput.value).toBe('1');
		});

		it('should show notes textarea when "Yes" or "No" is selected', async () => {
			const user = userEvent.setup();
			const { rerender } = render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			expect(screen.getByLabelText(/Mensaje para el festejado/i)).toBeInTheDocument();

			rerender(<RSVP {...defaultProps} />);
			await user.click(screen.getByLabelText(/No podré/i));
			expect(screen.getByLabelText(/Mensaje para el festejado/i)).toBeInTheDocument();
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

	describe('Canonical Copy', () => {
		it('all variants use "No podré" for decline option', () => {
			render(<RSVP {...defaultProps} variant="editorial" />);
			expect(screen.getByLabelText(/No podré/i)).toBeInTheDocument();
		});

		it('all variants use "Confirmar asistencia" for submit button', () => {
			const { rerender } = render(<RSVP {...defaultProps} variant="editorial" />);
			expect(
				screen.getByRole('button', { name: /Confirmar asistencia/i }),
			).toBeInTheDocument();

			rerender(<RSVP {...defaultProps} variant="premiere-floral" />);
			expect(
				screen.getByRole('button', { name: /Confirmar asistencia/i }),
			).toBeInTheDocument();

			rerender(<RSVP {...defaultProps} variant="celestial-blue" />);
			expect(
				screen.getByRole('button', { name: /Confirmar asistencia/i }),
			).toBeInTheDocument();
		});
	});

	describe('Guest Cap Validation', () => {
		it('should show error when guest count exceeds cap', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');

			const guestInput = screen.getByLabelText(/Número de asistentes/i);
			await user.clear(guestInput);
			await user.type(guestInput, '5');

			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(screen.getByText(/El límite de invitados/i)).toBeInTheDocument();
			});
		});

		it('should not show error when guest count is within cap', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');

			const guestInput = screen.getByLabelText(/Número de asistentes/i);
			await user.clear(guestInput);
			await user.type(guestInput, '2');

			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(screen.queryByText(/El límite de invitados/i)).not.toBeInTheDocument();
			});
		});
	});

	describe('Form Submission', () => {
		it('should switch the submit button to loading before the request resolves', async () => {
			const user = userEvent.setup();
			let resolveFetch: ((value: unknown) => void) | undefined;
			(global.fetch as jest.Mock).mockImplementation(
				() =>
					new Promise((resolve) => {
						resolveFetch = resolve;
					}),
			);

			const { container } = render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');
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

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');
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

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');
			await user.click(screen.getByLabelText(/No podré/i));
			await user.click(screen.getByRole('button', { name: /ENVIAR RESPUESTA/i }));

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

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(container.querySelector('form')).not.toBeInTheDocument();
			});
		});

		it('focuses and scrolls the success status into view after submission', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			const successRegion = await screen.findByRole('status');
			expect(successRegion).toHaveAttribute('aria-live', 'polite');
			expect(successRegion).toHaveAttribute('aria-atomic', 'true');
			expect(successRegion).toHaveAttribute('tabindex', '-1');
			await waitFor(() => expect(successRegion).toHaveFocus());
			expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
				behavior: 'smooth',
				block: 'center',
				inline: 'nearest',
			});
		});

		it('prevents duplicate RSVP submissions while loading', async () => {
			const user = userEvent.setup();
			let resolveFetch: ((value: unknown) => void) | undefined;
			(global.fetch as jest.Mock).mockImplementation(
				() =>
					new Promise((resolve) => {
						resolveFetch = resolve;
					}),
			);

			render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			const button = screen.getByRole('button', { name: /Confirmar/i });
			await user.click(button);
			await user.click(button);

			const submitCalls = (global.fetch as jest.Mock).mock.calls.filter(
				([url]) => typeof url === 'string' && PERSONALIZED_RSVP_URL.test(url),
			);
			expect(submitCalls).toHaveLength(1);

			resolveFetch?.({
				ok: true,
				json: async () => ({ rsvpId: 'mock-rsvp-id' }),
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

			expect(screen.getByLabelText(/Número de asistentes/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Mensaje para el festejado/i)).toBeInTheDocument();
		});
	});

	describe('Scroll Behavior', () => {
		beforeEach(() => {
			jest.clearAllMocks();
			window.innerHeight = 800;
			window.HTMLElement.prototype.scrollIntoView = jest.fn();
		});

		it('scrolls focused text input field into view with center block when it fits', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			const nameInput = screen.getByLabelText(/Tu nombre/i);
			nameInput.focus();

			await waitFor(() => {
				expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
					behavior: 'smooth',
					block: 'center',
					inline: 'nearest',
				});
			});
		});

		it('scrolls validation error field into view with center block when it fits', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const calls = (window.HTMLElement.prototype.scrollIntoView as jest.Mock).mock.calls;
				const lastCall = calls[calls.length - 1];
				expect(lastCall[0].block).toBe('center');
			});
		});

		it('validates block is start when the card does not fit the viewport', async () => {
			const user = userEvent.setup();
			jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
				height: 900,
			} as DOMRect);

			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const mockScroll = window.HTMLElement.prototype.scrollIntoView as jest.Mock;
				const callArgs = mockScroll.mock.calls.map((c) => c[0]);
				const scrollCalls = callArgs.filter((args) => args !== undefined);
				expect(scrollCalls.length).toBeGreaterThan(0);
				const lastCall = scrollCalls[scrollCalls.length - 1];
				expect(lastCall.block).toBe('start');
			});
		});
	});

	const PERSONALIZED_RSVP_URL = /\/api\/invitacion\/.*\/rsvp$/;
	const PUBLIC_RSVP_URL = /\/api\/invitacion\/public\//;

	describe('Submit Payload', () => {
		function findRsvpSubmitCall(urlPattern: RegExp) {
			return (global.fetch as jest.Mock).mock.calls.find(
				([url, init]) => typeof url === 'string' && urlPattern.test(url) && init?.body,
			);
		}

		it('personalized RSVP payload excludes name, phone, and countryCode', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'María Solís');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const fetchCall = findRsvpSubmitCall(PERSONALIZED_RSVP_URL);
				expect(fetchCall).toBeDefined();
				const body = JSON.parse(fetchCall[1].body);
				expect(body).not.toHaveProperty('fullName');
				expect(body).not.toHaveProperty('phone');
				expect(body).not.toHaveProperty('countryCode');
				expect(body).toHaveProperty('attendanceStatus');
				expect(body).toHaveProperty('attendeeCount');
				expect(body).toHaveProperty('guestComment');
			});
		});

		it('declined RSVP sends attendeeCount as 0', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'María Solís');
			await user.click(screen.getByLabelText(/No podré/i));
			await user.click(screen.getByRole('button', { name: /ENVIAR RESPUESTA/i }));

			await waitFor(() => {
				const fetchCall = findRsvpSubmitCall(PERSONALIZED_RSVP_URL);
				expect(fetchCall).toBeDefined();
				const body = JSON.parse(fetchCall[1].body);
				expect(body.attendanceStatus).toBe('declined');
				expect(body.attendeeCount).toBe(0);
			});
		});

		it('public RSVP initial submit without attendance does not show name-required error', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);

			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(screen.getByText(/Por favor, selecciona si asistirás/i)).toBeInTheDocument();
			});
			expect(screen.queryByText(/escribe tu nombre completo/i)).not.toBeInTheDocument();
		});

		it('public RSVP after selecting attendance requires name', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(screen.getByText(/escribe tu nombre completo/i)).toBeInTheDocument();
			});
		});

		it('public RSVP after selecting attendance allows empty phone', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.type(screen.getByLabelText(/Tu nombre/i), 'María Solís');
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const fetchCall = findRsvpSubmitCall(PUBLIC_RSVP_URL);
				expect(fetchCall).toBeDefined();
				const body = JSON.parse(fetchCall[1].body);
				expect(body).toHaveProperty('fullName', 'María Solís');
				expect(body).not.toHaveProperty('phone');
				expect(body).not.toHaveProperty('countryCode');
			});
		});

		it('public RSVP validates invalid phone only when provided', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.type(screen.getByLabelText(/Tu nombre/i), 'María Solís');
			await user.type(screen.getByLabelText(/Teléfono de contacto/i), '123');
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(screen.getByText(/Escribe un teléfono de 10 dígitos/i)).toBeInTheDocument();
			});
		});

		it('provided public phone includes phone and countryCode in payload', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="hybrid"
					confirmationMessage="Gracias"
				/>,
			);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.type(screen.getByLabelText(/Tu nombre/i), 'María Solís');
			await user.type(screen.getByLabelText(/Teléfono de contacto/i), '6680000000');
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const fetchCall = findRsvpSubmitCall(PUBLIC_RSVP_URL);
				expect(fetchCall).toBeDefined();
				const body = JSON.parse(fetchCall[1].body);
				expect(body).toHaveProperty('phone', '6680000000');
				expect(body).toHaveProperty('countryCode', '+52');
			});
		});

		it('whitespace-only notes send guestComment as empty string', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'María Solís');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			const notesInput = screen.getByLabelText(/Mensaje para el festejado/i);
			await user.type(notesInput, '   ');
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const fetchCall = findRsvpSubmitCall(PERSONALIZED_RSVP_URL);
				expect(fetchCall).toBeDefined();
				const body = JSON.parse(fetchCall[1].body);
				expect(body).toHaveProperty('guestComment', '');
			});
		});

		it('personalized RSVP does not render name field', () => {
			render(
				<RSVP
					{...defaultProps}
					initialGuestData={{ inviteId: 'mock-invite-id', fullName: 'María Solís' }}
				/>,
			);
			expect(screen.queryByLabelText(/Tu nombre/i)).not.toBeInTheDocument();
		});

		it('personalized RSVP does not render phone field', () => {
			render(
				<RSVP
					{...defaultProps}
					initialGuestData={{ inviteId: 'mock-invite-id', fullName: 'María Solís' }}
				/>,
			);
			expect(screen.queryByLabelText(/Teléfono de contacto/i)).not.toBeInTheDocument();
		});

		it('personalized RSVP with nameLocked still submits with correct attendeeCount', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					{...defaultProps}
					initialGuestData={{ inviteId: 'mock-invite-id', fullName: 'María Solís' }}
				/>,
			);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const fetchCall = findRsvpSubmitCall(PERSONALIZED_RSVP_URL);
				expect(fetchCall).toBeDefined();
				const body = JSON.parse(fetchCall[1].body);
				expect(body.attendanceStatus).toBe('confirmed');
				expect(body.attendeeCount).toBe(1);
			});
		});
	});

	describe('Auto-focus on Errors', () => {
		it('should focus the name field if it is the first empty required field', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			const button = screen.getByRole('button', { name: /Confirmar/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByLabelText(/Tu nombre/i)).toHaveFocus();
			});
		});

		it('should focus the attendance radio if name is present but attendance is missing', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			const nameInput = screen.getByLabelText(/Tu nombre/i);
			await user.type(nameInput, 'Test User');

			const button = screen.getByRole('button', { name: /Confirmar/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByLabelText(/Sí, asistiré/i)).toHaveFocus();
			});
		});
	});
});
