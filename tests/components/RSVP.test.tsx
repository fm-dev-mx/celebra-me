// tests/components/RSVP.test.tsx
// Component tests for the RSVP form

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RSVP from '@/components/invitation/RSVP';
import type { ComponentProps } from 'react';

const PERSONALIZED_RSVP_URL = /\/api\/invitacion\/.*\/rsvp$/;
const PUBLIC_RSVP_URL = /\/api\/invitacion\/public\//;

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

	const revealedLocation = {
		visibility: 'after-rsvp' as const,
		introHeading: 'Ubicación',
		ceremony: {
			venueEvent: 'Celebración',
			venueName: 'Salón García',
			address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
			date: '2026-08-01',
			time: '14:00',
			googleMapsUrl: 'https://maps.example.com/salon-garcia',
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

		// No-op ResizeObserver so the compact mode effect does not crash in jsdom
		global.ResizeObserver = class {
			constructor() {
				/* noop */
			}
			observe() {
				/* noop */
			}
			disconnect() {
				/* noop */
			}
			unobserve() {
				/* noop */
			}
		} as unknown as typeof ResizeObserver;
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

		it('should render the confirm button after attendance is selected', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			expect(screen.queryByRole('button', { name: /Confirmar/i })).not.toBeInTheDocument();
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
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

		it('unlocks the form for hybrid public RSVP', async () => {
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

			expect(screen.queryByText(/utiliza enlaces personalizados/i)).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /Confirmar/i })).not.toBeInTheDocument();
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
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
			const user = userEvent.setup();
			render(<RSVP {...demoProps} />);

			await waitFor(() => {
				expect(
					screen.queryByText(/utiliza enlaces personalizados/i),
				).not.toBeInTheDocument();
			});
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
			expect(screen.getByText(/Demo interactiva/)).toBeInTheDocument();
		});

		it('shows success state in demo preview mode after form submission', async () => {
			const user = userEvent.setup();
			render(<RSVP {...demoProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const status = screen.getByRole('status');
				expect(within(status).getByRole('heading', { level: 2 })).toHaveTextContent(
					'Gracias por confirmar, María Fernanda Solís',
				);
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

		it('"Sí, asistiré" shows attendee count with guestCap value by default', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} guestCap={10} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			const guestInput = screen.getByLabelText(/Número de asistentes/i) as HTMLInputElement;
			expect(guestInput.value).toBe('10');
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

		it('switching "No podré" to "Sí, asistiré" preserves attendee count at guestCap', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} guestCap={10} />);

			await user.click(screen.getByLabelText(/No podré/i));
			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			const guestInput = screen.getByLabelText(/Número de asistentes/i) as HTMLInputElement;
			expect(guestInput.value).toBe('10');
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

		it('button appears after attendance selection', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			expect(screen.queryByRole('button', { name: /Confirmar/i })).not.toBeInTheDocument();

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
		});

		it('shows name validation error on submit without name', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));
			await waitFor(() => {
				expect(screen.getByText(/escribe tu nombre completo/i)).toBeInTheDocument();
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

		it('all variants use "Confirmar asistencia" for submit button', async () => {
			const user = userEvent.setup();
			const { rerender } = render(<RSVP {...defaultProps} variant="editorial" />);
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			expect(
				screen.getByRole('button', { name: /Confirmar asistencia/i }),
			).toBeInTheDocument();

			rerender(<RSVP {...defaultProps} variant="premiere-floral" />);
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			expect(
				screen.getByRole('button', { name: /Confirmar asistencia/i }),
			).toBeInTheDocument();

			rerender(<RSVP {...defaultProps} variant="celestial-blue" />);
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
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
				const status = screen.getByRole('status');
				expect(within(status).getByRole('heading', { level: 2 })).toHaveTextContent(
					'¡Gracias por confirmar, Test User!',
				);
			});
		});

		it('should show confirmation message on successful "Yes" submission', async () => {
			const user = userEvent.setup();
			const { container } = render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const body = container.querySelector('.rsvp__greeting-message-body');
				expect(body?.textContent).toContain('¡Gracias por confirmar!');
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
			expect(window.scrollTo).toHaveBeenCalledWith({
				top: expect.any(Number),
				behavior: 'smooth',
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

		it('should submit declined response successfully', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');
			await user.click(screen.getByLabelText(/No podré/i));

			const button = screen.getByRole('button', { name: /ENVIAR RESPUESTA/i });
			await user.click(button);

			await waitFor(() => {
				expect(
					screen.getByText(
						(content) =>
							content.includes('Sentimos mucho') && content.includes('no puedas'),
					),
				).toBeInTheDocument();
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
		});

		it('scrolls RSVP card into view via window.scrollTo when a field receives focus', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			const nameInput = screen.getByLabelText(/Tu nombre/i);
			nameInput.focus();

			await waitFor(() => {
				expect(window.scrollTo).toHaveBeenCalledWith(
					expect.objectContaining({ behavior: 'smooth', top: expect.any(Number) }),
				);
			});
		});

		it('scrolls validation error field into view with center block when it fits', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
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

	describe('Compact Mode — CSS-only', () => {
		it('does not toggle rsvp--compact from JS', async () => {
			const user = userEvent.setup();
			const { container } = render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));

			const card = container.querySelector('.rsvp') as HTMLElement;
			expect(card).not.toHaveClass('rsvp--compact');
		});

		it('renders the canonical RSVP shell for the form state', () => {
			const { container } = render(<RSVP {...defaultProps} />);

			const section = container.querySelector('#rsvp.rsvp-section');
			const card = container.querySelector('.rsvp') as HTMLElement;
			expect(section).toBeInTheDocument();
			expect(section?.querySelector(':scope > .rsvp')).toBe(card);
			expect(card).toHaveAttribute('data-state', 'form');
			expect(card).not.toHaveClass('rsvp--expanded');
			expect(card.querySelector(':scope > .rsvp__header')).toBeInTheDocument();
			expect(card.querySelector(':scope > form.rsvp__form')).toBeInTheDocument();
		});

		it('renders the canonical RSVP shell for locked and submitted states', async () => {
			const user = userEvent.setup();
			const locked = render(
				<RSVP
					eventType="xv"
					eventSlug="demo-xv-jewelry-box"
					title="¿Vienes a celebrar conmigo?"
					guestCap={2}
					accessMode="personalized-only"
					confirmationMessage="Gracias"
				/>,
			);

			const lockedCard = locked.container.querySelector('#rsvp.rsvp-section > .rsvp');
			expect(lockedCard).toHaveAttribute('data-state', 'locked');
			expect(lockedCard?.querySelector(':scope > .rsvp__header')).toBeInTheDocument();
			locked.unmount();

			const submitted = render(<RSVP {...defaultProps} />);
			await user.type(screen.getByLabelText(/Tu nombre/i), 'Test User');
			await user.click(screen.getByLabelText(/No podré/i));
			await user.click(screen.getByRole('button', { name: /ENVIAR RESPUESTA/i }));

			await waitFor(() => {
				const submittedCard = submitted.container.querySelector(
					'#rsvp.rsvp-section > .rsvp',
				);
				expect(submittedCard).toHaveAttribute('data-state', 'declined');
				expect(submittedCard?.querySelector(':scope > .rsvp__header')).toBeInTheDocument();
				expect(submittedCard?.querySelector(':scope > .rsvp__status')).toBeInTheDocument();
			});
		});
	});

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

		it('public RSVP after selecting attendance requires name before submit', async () => {
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

		it('personalized RSVP with nameLocked submits with effectiveGuestCap as attendeeCount', async () => {
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
				expect(body.attendeeCount).toBe(defaultProps.guestCap);
			});
		});
	});

	describe('Auto-focus on Errors', () => {
		it('should focus the name field if it is the first empty required field', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			const button = screen.getByRole('button', { name: /Confirmar/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByLabelText(/Tu nombre/i)).toHaveFocus();
			});
		});
	});

	describe('Custom RSVP Response Messages', () => {
		it('shows custom confirmed title and body copy after submission', async () => {
			const user = userEvent.setup();
			const { container } = render(
				<RSVP
					{...defaultProps}
					confirmationMessage="Esperamos verte pronto."
					responseMessages={{
						confirmed: {
							title: '¡Qué bueno que vienes, {guestName}!',
							subtitle: 'Te registramos correctamente.',
						},
					}}
				/>,
			);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Ana');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const status = screen.getByRole('status');
				const heading = within(status).getByRole('heading', { level: 2 });
				const body = container.querySelector('.rsvp__greeting-message-body');
				expect(heading).toHaveTextContent('¡Qué bueno que vienes, Ana!');
				expect(screen.getByText('Te registramos correctamente.')).toBeInTheDocument();
				expect(heading).not.toHaveTextContent('Esperamos verte pronto.');
				expect(body).toBeInTheDocument();
				expect(body).toHaveTextContent('Esperamos verte pronto.');
			});
		});

		it('shows custom declined title and subtitle after submission', async () => {
			const user = userEvent.setup();
			render(
				<RSVP
					{...defaultProps}
					responseMessages={{
						declined: {
							title: 'Te extrañaremos, {guestName}.',
							subtitle: 'Gracias por avisar.',
						},
					}}
				/>,
			);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Carlos');
			await user.click(screen.getByLabelText(/No podré/i));
			await user.click(screen.getByRole('button', { name: /ENVIAR RESPUESTA/i }));

			await waitFor(() => {
				expect(screen.getByText('Te extrañaremos, Carlos.')).toBeInTheDocument();
				expect(screen.getByText('Gracias por avisar.')).toBeInTheDocument();
			});
		});

		it('falls back to defaults when responseMessages is not provided', async () => {
			const user = userEvent.setup();
			render(<RSVP {...defaultProps} />);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'María');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(
					screen.getByText((content) =>
						content.includes('¡Gracias por confirmar, María!'),
					),
				).toBeInTheDocument();
				expect(screen.getByText('Tu confirmación ha sido registrada.')).toBeInTheDocument();
			});
		});

		it('shows confirmationMessage as body copy when responseMessages is omitted', async () => {
			const user = userEvent.setup();
			const { container } = render(
				<RSVP
					{...defaultProps}
					confirmationMessage="Legacy message for backward compatibility"
				/>,
			);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Laura');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const status = screen.getByRole('status');
				const heading = within(status).getByRole('heading', { level: 2 });
				const body = container.querySelector('.rsvp__greeting-message-body');
				expect(heading).toHaveTextContent('¡Gracias por confirmar, Laura!');
				expect(heading).not.toHaveTextContent('Legacy message for backward compatibility');
				expect(body).toHaveTextContent('Legacy message for backward compatibility');
			});
		});

		it('interpolates {celebrantName} in custom messages', async () => {
			const user = userEvent.setup();
			const { container } = render(
				<RSVP
					{...defaultProps}
					celebrantName="Sofía"
					responseMessages={{
						confirmed: {
							title: '{guestName} confirma para la fiesta de {celebrantName}',
							subtitle: 'Listo.',
						},
					}}
				/>,
			);

			await user.type(screen.getByLabelText(/Tu nombre/i), 'Pedro');
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				const greeting = container.querySelector('.rsvp__greeting-message');
				expect(greeting?.textContent).toContain('Pedro confirma para la fiesta de Sofía');
			});
		});
	});

	describe('RSVP-only location reveal', () => {
		function renderRSVP(
			overrides: Partial<ComponentProps<typeof RSVP>> & {
				initialGuestData?: ComponentProps<typeof RSVP>['initialGuestData'];
			},
		) {
			return render(<RSVP {...defaultProps} {...overrides} />);
		}

		it('renders confirmed initial state with revealed location and edit action', async () => {
			renderRSVP({
				initialGuestData: {
					inviteId: 'mock-invite-id',
					fullName: 'María Solís',
					maxAllowedAttendees: 4,
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Nos vemos pronto',
				},
				revealedLocation,
				enableResponseEditing: true,
			});

			const status = await screen.findByRole('status');
			expect(within(status).getByText(/Salón García/)).toBeInTheDocument();
			expect(within(status).getByText(/Victoriano Huerta 51/)).toBeInTheDocument();
			expect(
				within(status).getByRole('link', { name: /Abrir en Google Maps/i }),
			).toHaveAttribute('href', 'https://maps.example.com/salon-garcia');
			expect(
				screen.getByRole('button', { name: /Cambiar mi respuesta/i }),
			).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /^Cancelar$/i })).not.toBeInTheDocument();
		});

		it('opens a prefilled form and cancels back to confirmed success state', async () => {
			const user = userEvent.setup();
			renderRSVP({
				initialGuestData: {
					inviteId: 'mock-invite-id',
					fullName: 'María Solís',
					maxAllowedAttendees: 4,
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Nos vemos pronto',
				},
				revealedLocation,
				enableResponseEditing: true,
			});

			await user.click(screen.getByRole('button', { name: /Cambiar mi respuesta/i }));

			expect(screen.getByLabelText(/Sí, asistiré/i)).toBeChecked();
			expect(screen.getByLabelText(/Número de asistentes/i)).toHaveValue(2);
			expect(screen.getByLabelText(/Mensaje para el festejado/i)).toHaveValue(
				'Nos vemos pronto',
			);
			expect(screen.getByRole('button', { name: /^Cancelar$/i })).toBeInTheDocument();

			await user.click(screen.getByRole('button', { name: /^Cancelar$/i }));

			const status = await screen.findByRole('status');
			expect(within(status).getByText(/Salón García/)).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /^Cancelar$/i })).not.toBeInTheDocument();
		});

		it('hides revealed location after changing response to declined', async () => {
			const user = userEvent.setup();
			renderRSVP({
				initialGuestData: {
					inviteId: 'mock-invite-id',
					fullName: 'María Solís',
					maxAllowedAttendees: 4,
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: '',
				},
				revealedLocation,
				enableResponseEditing: true,
			});

			await user.click(screen.getByRole('button', { name: /Cambiar mi respuesta/i }));
			await user.click(screen.getByLabelText(/No podré/i));
			await user.click(screen.getByRole('button', { name: /ENVIAR RESPUESTA/i }));

			await waitFor(() => {
				expect(screen.getByRole('status')).toBeInTheDocument();
			});
			expect(screen.queryByText(/Salón García/)).not.toBeInTheDocument();
		});

		it('re-fetches and reveals location after re-confirming attendance', async () => {
			const user = userEvent.setup();
			(global.fetch as jest.Mock).mockImplementation((url: string) => {
				if (url.includes('/location')) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: async () => ({ success: true, data: { location: revealedLocation } }),
					} as Response);
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: async () => ({ rsvpId: 'mock-rsvp-id' }),
				} as Response);
			});

			renderRSVP({
				initialGuestData: {
					inviteId: 'mock-invite-id',
					fullName: 'María Solís',
					maxAllowedAttendees: 4,
					attendanceStatus: 'declined',
					attendeeCount: 0,
					guestComment: '',
				},
				enableResponseEditing: true,
			});

			await user.click(screen.getByRole('button', { name: /Cambiar mi respuesta/i }));
			await user.click(screen.getByLabelText(/Sí, asistiré/i));
			await user.click(screen.getByRole('button', { name: /Confirmar/i }));

			await waitFor(() => {
				expect(screen.getByText(/Salón García/)).toBeInTheDocument();
			});
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('/api/invitacion/mock-invite-id/location'),
				expect.anything(),
			);
		});
	});
});
