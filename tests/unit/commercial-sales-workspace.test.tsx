import { fireEvent, render, screen } from '@testing-library/react';

import SalesWorkspace from '@/components/dashboard/commercial/SalesWorkspace';

describe('SalesWorkspace', () => {
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
			'Siguiente: Crear ficha de cliente',
		);
		expect(screen.getByText('Selecciona una persona u oportunidad')).toBeInTheDocument();
		expect(screen.getByText('Buscar otro cliente o prospecto')).toBeInTheDocument();
		expect(screen.queryByLabelText('Código de lead')).not.toBeVisible();
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
