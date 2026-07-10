import { render, screen } from '@testing-library/react';

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
});
