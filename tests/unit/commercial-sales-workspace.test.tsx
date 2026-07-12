import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import SalesWorkspace from '@/components/dashboard/commercial/SalesWorkspace';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type { ApiResult } from '@/lib/api-client-shared';

/* ------------------------------------------------------------------ */
/*  Polling constants mirrored from SalesWorkspace                    */
/* ------------------------------------------------------------------ */

const POLL_MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 1000;

/* ------------------------------------------------------------------ */
/*  Typed mock helpers                                                */
/* ------------------------------------------------------------------ */

interface MockGetOpts {
	customerId?: string;
	customerName?: string;
	customerEmail?: string;
	orderId?: string;
	orderNumber?: string;
	totalAmount?: number;
	depositAmount?: number;
	conversionStatus?: string | ((pollCount: number) => string);
}

function createMockGetImplementation(opts: MockGetOpts = {}) {
	let pollCount = 0;
	const {
		customerId = 'c1',
		customerName = 'C',
		customerEmail = 'c@c.com',
		orderId = 'o1',
		orderNumber = 'O1',
		totalAmount = 1000,
		depositAmount = 500,
		conversionStatus = 'pending',
	} = opts;

	return async (url: string): Promise<ApiResult<unknown>> => {
		if (url.includes('/api/dashboard/commercial/customers?')) {
			return {
				ok: true,
				status: 200,
				data: {
					data: { id: customerId, displayName: customerName, email: customerEmail },
				},
			};
		}
		if (url.includes('/api/dashboard/commercial/orders?')) {
			return {
				ok: true,
				status: 200,
				data: {
					data: [
						{
							id: orderId,
							orderNumber,
							customerId,
							status: 'confirmed',
							eventType: 'xv',
							currency: 'MXN',
							totalAmount,
							depositAmount,
							amountPaid: 0,
						},
					],
				},
			};
		}
		if (url.includes('/api/dashboard/commercial/timeline?')) {
			return { ok: true, status: 200, data: { data: [] } };
		}
		if (url.includes('/api/dashboard/commercial/meta-conversions/status?')) {
			if (typeof conversionStatus === 'function') {
				pollCount++;
				return {
					ok: true,
					status: 200,
					data: { data: { status: conversionStatus(pollCount) } },
				};
			}
			return {
				ok: true,
				status: 200,
				data: { data: { status: conversionStatus } },
			};
		}
		return { ok: true, status: 200, data: { data: [] } };
	};
}

function defaultPostResponse(overrides?: { conversionEvent?: { id: string; status: string } }): ApiResult<unknown> {
	return {
		ok: true as const,
		status: 200,
		data: {
			data: {
				order: {
					id: 'o1',
					orderNumber: 'O1',
					customerId: 'c1',
					status: 'deposit_paid',
					eventType: 'xv',
					currency: 'MXN',
					totalAmount: 1000,
					depositAmount: 500,
					amountPaid: 500,
				},
				conversionEvent: overrides?.conversionEvent ?? {
					id: 'conv-1',
					status: 'pending',
				},
			},
		},
	};
}

const defaultLead = {
	id: 'l1',
	leadCode: 'L1',
	channel: 'whatsapp' as const,
	status: 'new' as const,
	name: 'T',
	customerId: 'c1',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('SalesWorkspace', () => {
	let savedScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;

	beforeAll(() => {
		savedScrollIntoView = HTMLElement.prototype.scrollIntoView;
		HTMLElement.prototype.scrollIntoView = jest.fn();
	});

	afterAll(() => {
		HTMLElement.prototype.scrollIntoView = savedScrollIntoView;
	});

	it('starts with a commercial work queue instead of an open form', () => {
		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-1',
						leadCode: 'CM-ABC123',
						channel: 'whatsapp',
						status: 'new',
						name: 'María Ejemplo',
						phone: '6141234567',
						eventType: 'xv',
					},
				]}
			/>,
		);

		expect(screen.getByRole('heading', { name: 'Seguimientos recientes' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /María Ejemplo/ })).toHaveTextContent(
			'Siguiente: Vincular o crear cliente',
		);
		expect(screen.getByText('Selecciona una persona u oportunidad')).toBeInTheDocument();
		expect(screen.getAllByText('Buscar prospecto o cliente')).toHaveLength(2);
		expect(screen.queryByLabelText('Código de lead')).not.toBeVisible();
	});

	it('moves focus to identity resolution when the operator chooses the next action', () => {
		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-focus',
						leadCode: 'CM-FOCUS',
						channel: 'contact_form',
						status: 'new',
						name: 'Persona Enfoque',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Persona Enfoque/ }));
		const nextAction = screen
			.getAllByRole('button', { name: 'Vincular o crear cliente' })
			.find((button) => button.getAttribute('type') === 'button');
		expect(nextAction).toBeDefined();
		fireEvent.click(nextAction!);

		expect(screen.getByLabelText('Nombre completo *')).toHaveFocus();
		expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
	});

	it('presents an incomplete prospect as an intentional commercial record', () => {
		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-incomplete',
						leadCode: 'CM-INCOMPLETE',
						channel: 'manual',
						status: 'new',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Prospecto sin nombre/ }));

		expect(screen.getByRole('heading', { name: 'Prospecto sin nombre' })).toBeInTheDocument();
		expect(screen.getAllByText('CM-INCOMPLETE')).toHaveLength(3);
		expect(screen.getByText('Sin contacto registrado')).toBeInTheDocument();
		expect(
			screen.getByText('La ficha habilita órdenes, cobros e historial comercial.'),
		).toBeInTheDocument();
	});

	it('shows WhatsApp CTA for a prospect with a valid E.164 phoneE164', () => {
		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-valid',
						leadCode: 'CM-VALID',
						channel: 'whatsapp',
						status: 'contacted',
						name: 'Ana Ejemplo',
						phone: '55 1234 5678',
						phoneE164: '+525512345678',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Ana Ejemplo/ }));

		expect(screen.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute(
			'href',
			'https://wa.me/525512345678',
		);
	});

	it('hides WhatsApp CTA for a prospect with a local / incomplete phone (no country code)', () => {
		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-local',
						leadCode: 'CM-LOCAL',
						channel: 'manual',
						status: 'new',
						name: 'Luis Incompleto',
						phone: '6141234567',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Luis Incompleto/ }));
		expect(screen.queryByRole('link', { name: 'Abrir WhatsApp' })).not.toBeInTheDocument();
	});

	it('hides WhatsApp CTA for a prospect with a masked phoneE164', () => {
		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-masked',
						leadCode: 'CM-MASKED',
						channel: 'whatsapp',
						status: 'contacted',
						name: 'Sofía Masked',
						phone: '55 0000 0103',
						phoneE164: '+525****0103',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Sofía Masked/ }));
		expect(screen.queryByRole('link', { name: 'Abrir WhatsApp' })).not.toBeInTheDocument();
	});

	it('hides WhatsApp CTA for a prospect with no phone data', () => {
		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-nophone',
						leadCode: 'CM-NOPHONE',
						channel: 'email',
						status: 'new',
						name: 'Claudia SinTeléfono',
						email: 'claudia@ejemplo.com',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Claudia SinTeléfono/ }));
		expect(screen.queryByRole('link', { name: 'Abrir WhatsApp' })).not.toBeInTheDocument();
	});
});

/* ------------------------------------------------------------------ */
/*  Customer lookup & CAPI polling                                    */
/* ------------------------------------------------------------------ */

describe('SalesWorkspace — customer lookup & CAPI polling', () => {
	let getSpy: jest.SpiedFunction<typeof dashboardApi.get>;
	let postSpy: jest.SpiedFunction<typeof dashboardApi.post>;
	let savedScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;

	beforeAll(() => {
		savedScrollIntoView = HTMLElement.prototype.scrollIntoView;
		HTMLElement.prototype.scrollIntoView = jest.fn();
	});

	afterAll(() => {
		HTMLElement.prototype.scrollIntoView = savedScrollIntoView;
	});

	beforeEach(() => {
		getSpy = jest
			.spyOn(dashboardApi, 'get')
			.mockResolvedValue({ ok: true, status: 200, data: { data: [] } });
		postSpy = jest
			.spyOn(dashboardApi, 'post')
			.mockResolvedValue({ ok: true, status: 200, data: { data: {} } });
	});

	afterEach(() => {
		getSpy.mockRestore();
		postSpy.mockRestore();
		jest.useRealTimers();
	});

	it('fetches real customer data after selecting a linked lead', async () => {
		getSpy.mockImplementation(async (url: string): Promise<ApiResult<unknown>> => {
			if (url.includes('/api/dashboard/commercial/customers?')) {
				return {
					ok: true,
					status: 200,
					data: {
						data: {
							id: 'cust-real-123',
							displayName: 'Cliente Real',
							email: 'real@customer.com',
						},
					},
				};
			}
			return { ok: true, status: 200, data: { data: [] } };
		});

		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-linked',
						leadCode: 'CM-LINKED',
						channel: 'whatsapp',
						status: 'new',
						name: 'Cliente Vinculado',
						email: 'lead@example.com',
						customerId: 'cust-real-123',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Cliente Vinculado/ }));

		await waitFor(() => {
			expect(screen.getByText('real@customer.com')).toBeInTheDocument();
		});

		expect(getSpy).toHaveBeenCalledWith(
			expect.stringContaining('/api/dashboard/commercial/customers?id=cust-real-123'),
		);

		expect(screen.queryByText('lead@example.com')).not.toBeInTheDocument();
	});

	it('shows error when customer lookup fails', async () => {
		getSpy.mockImplementation(async (url: string): Promise<ApiResult<unknown>> => {
			if (url.includes('/api/dashboard/commercial/customers?')) {
				return {
					ok: false,
					status: 404,
					code: 'not_found',
					message: 'No se pudo cargar la ficha del cliente.',
				};
			}
			return { ok: true, status: 200, data: { data: [] } };
		});

		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-linked',
						leadCode: 'CM-LINKED',
						channel: 'whatsapp',
						status: 'new',
						name: 'Cliente Vinculado',
						email: 'lead@example.com',
						customerId: 'cust-real-123',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Cliente Vinculado/ }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent(
				'No se pudo cargar la ficha del cliente. Los datos mostrados pueden estar incompletos.',
			);
		});
	});

	it('failed lookup does not show lead email as authoritative customer data', async () => {
		getSpy.mockImplementation(async (url: string): Promise<ApiResult<unknown>> => {
			if (url.includes('/api/dashboard/commercial/customers?')) {
				return {
					ok: false,
					status: 404,
					code: 'not_found',
					message: 'Not found',
				};
			}
			return { ok: true, status: 200, data: { data: [] } };
		});

		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-orphan',
						leadCode: 'CM-ORPHAN',
						channel: 'whatsapp',
						status: 'new',
						name: 'Huerfano',
						email: 'orphan@lead.com',
						customerId: 'cust-ghost',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Huerfano/ }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toBeInTheDocument();
		});

		expect(screen.queryByText('Ficha comercial')).not.toBeInTheDocument();
	});

	it('polls conversion status and updates message on success', async () => {
		jest.useFakeTimers();

		getSpy.mockImplementation(createMockGetImplementation({
			customerId: 'cust-1',
			customerName: 'Test',
			customerEmail: 't@c.com',
			orderId: 'order-1',
			orderNumber: 'ORD-001',
			totalAmount: 10000,
			depositAmount: 5000,
			conversionStatus: 'sent',
		}));

		postSpy.mockResolvedValue(defaultPostResponse());

		render(<SalesWorkspace initialLeads={[defaultLead]} />);

		fireEvent.click(screen.getByRole('button', { name: /T/ }));
		await screen.findByText('Registrar anticipo');
		fireEvent.click(screen.getByRole('button', { name: 'Registrar anticipo' }));

		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('Conversión pendiente');
		});

		const statusCallsBefore = getSpy.mock.calls.filter(
			([url]) => typeof url === 'string' && url.includes('/meta-conversions/status?'),
		).length;

		await act(async () => {
			await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		});

		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('Conversión enviada');
		});

		const statusCallsAfter = getSpy.mock.calls.filter(
			([url]) => typeof url === 'string' && url.includes('/meta-conversions/status?'),
		).length;

		expect(statusCallsAfter).toBe(statusCallsBefore + 1);

		expect(getSpy).toHaveBeenCalledWith(
			expect.stringContaining('/meta-conversions/status?id=conv-1'),
		);
	});

	it('polls up to max attempts and keeps pending message when status never resolves', async () => {
		jest.useFakeTimers();

		getSpy.mockImplementation(createMockGetImplementation());
		postSpy.mockResolvedValue(defaultPostResponse());

		render(<SalesWorkspace initialLeads={[defaultLead]} />);

		fireEvent.click(screen.getByRole('button', { name: /T/ }));
		await screen.findByText('Registrar anticipo');
		fireEvent.click(screen.getByRole('button', { name: 'Registrar anticipo' }));

		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('Conversión pendiente');
		});

		await act(async () => {
			await jest.advanceTimersByTimeAsync(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS + 500);
		});

		expect(screen.getByRole('status')).toHaveTextContent('Conversión pendiente');

		const statusCalls = getSpy.mock.calls.filter(
			([url]) => typeof url === 'string' && url.includes('/meta-conversions/status?'),
		);
		expect(statusCalls).toHaveLength(POLL_MAX_ATTEMPTS);

		const callsBefore = statusCalls.length;

		await act(async () => {
			await jest.advanceTimersByTimeAsync(5000);
		});

		const callsAfter = getSpy.mock.calls.filter(
			([url]) => typeof url === 'string' && url.includes('/meta-conversions/status?'),
		).length;

		expect(callsAfter).toBe(callsBefore);
	});

	it('failed status shows attention message', async () => {
		jest.useFakeTimers();

		getSpy.mockImplementation(createMockGetImplementation({
			conversionStatus: (n) => (n >= 5 ? 'failed' : 'pending'),
		}));

		postSpy.mockResolvedValue(defaultPostResponse());

		render(<SalesWorkspace initialLeads={[defaultLead]} />);

		fireEvent.click(screen.getByRole('button', { name: /T/ }));
		await screen.findByText('Registrar anticipo');
		fireEvent.click(screen.getByRole('button', { name: 'Registrar anticipo' }));

		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('Conversión pendiente');
		});

		await act(async () => {
			await jest.advanceTimersByTimeAsync(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS + 500);
		});

		expect(screen.getByRole('status')).toHaveTextContent('Conversión requiere atención');
	});

	it('unmount during polling stops further status requests', async () => {
		jest.useFakeTimers();

		getSpy.mockImplementation(createMockGetImplementation());
		postSpy.mockResolvedValue(defaultPostResponse());

		const { unmount } = render(<SalesWorkspace initialLeads={[defaultLead]} />);

		fireEvent.click(screen.getByRole('button', { name: /T/ }));
		await screen.findByText('Registrar anticipo');
		fireEvent.click(screen.getByRole('button', { name: 'Registrar anticipo' }));

		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('Conversión pendiente');
		});

		const callsBefore = getSpy.mock.calls.filter(
			([url]) => typeof url === 'string' && url.includes('/meta-conversions/status?'),
		).length;

		unmount();

		await act(async () => {
			await jest.advanceTimersByTimeAsync(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS * 2);
		});

		const callsAfter = getSpy.mock.calls.filter(
			([url]) => typeof url === 'string' && url.includes('/meta-conversions/status?'),
		).length;

		expect(callsAfter).toBe(callsBefore);
	});

	it('second poll invalidates first — stale poll never reaches the API', async () => {
		jest.useFakeTimers();

		let postCallCount = 0;

		postSpy.mockImplementation(async (): Promise<ApiResult<unknown>> => {
			postCallCount++;
			const convId = postCallCount === 1 ? 'conv-old' : 'conv-new';
			return defaultPostResponse({ conversionEvent: { id: convId, status: 'pending' } });
		});

		getSpy.mockImplementation(async (url: string): Promise<ApiResult<unknown>> => {
			if (url.includes('/api/dashboard/commercial/customers?')) {
				return {
					ok: true,
					status: 200,
					data: {
						data: { id: 'c1', displayName: 'C', email: 'c@c.com' },
					},
				};
			}
			if (url.includes('/api/dashboard/commercial/orders?')) {
				return {
					ok: true,
					status: 200,
					data: {
						data: [
							{
								id: 'o1',
								orderNumber: 'O1',
								customerId: 'c1',
								status: 'confirmed',
								eventType: 'xv',
								currency: 'MXN',
								totalAmount: 1000,
								depositAmount: 500,
								amountPaid: 0,
							},
						],
					},
				};
			}
			if (url.includes('/api/dashboard/commercial/timeline?')) {
				return { ok: true, status: 200, data: { data: [] } };
			}
			if (url.includes('/api/dashboard/commercial/meta-conversions/status?')) {
				if (url.includes('conv-new')) {
					return { ok: true, status: 200, data: { data: { status: 'sent' } } };
				}
				// conv-old should never be reached — the generation check aborts first
				return { ok: true, status: 200, data: { data: { status: 'failed' } } };
			}
			return { ok: true, status: 200, data: { data: [] } };
		});

		render(<SalesWorkspace initialLeads={[defaultLead]} />);

		fireEvent.click(screen.getByRole('button', { name: /T/ }));
		await screen.findByText('Registrar anticipo');

		// First deposit — returns conv-old, starts poll with generation=1
		fireEvent.click(screen.getByRole('button', { name: 'Registrar anticipo' }));
		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('Conversión pendiente');
		});

		// Before the first poll's setTimeout resolves, trigger a second deposit
		// This increments generation to 2, which will invalidate the first poll
		fireEvent.click(screen.getByRole('button', { name: 'Registrar anticipo' }));
		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('Conversión pendiente');
		});

		// Advance timers — both polls' setTimeouts resolve, but:
		// - First poll checks generation (1 !== 2) → aborts BEFORE calling API
		// - Second poll checks generation (2 === 2) → calls API for conv-new → gets 'sent'
		await act(async () => {
			await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		});

		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('Conversión enviada');
		});

		// Only conv-new should have been polled — conv-old was invalidated before its API call
		const statusCalls = getSpy.mock.calls.filter(
			([url]) => typeof url === 'string' && url.includes('/meta-conversions/status?'),
		);
		const urls = statusCalls.map(([url]) => url as string);
		expect(urls.some((u) => u.includes('conv-old'))).toBe(false);
		expect(urls.some((u) => u.includes('conv-new'))).toBe(true);
		expect(statusCalls).toHaveLength(1);
	});
});
