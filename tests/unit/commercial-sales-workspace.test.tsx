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

	it('offers WhatsApp from a prospect when phone data exists', () => {
		render(
			<SalesWorkspace
				initialLeads={[
					{
						id: 'lead-whatsapp',
						leadCode: 'CM-WHATSAPP',
						channel: 'whatsapp',
						status: 'contacted',
						name: 'Sofía Ejemplo',
						phone: '55 0000 0103',
						phoneE164: '+525500000103',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Sofía Ejemplo/ }));

		expect(screen.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute(
			'href',
			'https://wa.me/525500000103',
		);
	});
});
