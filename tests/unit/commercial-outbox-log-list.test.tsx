import { render, screen } from '@testing-library/react';

import OutboxLogList from '@/components/dashboard/commercial/OutboxLogList';

describe('OutboxLogList', () => {
	it('makes disabled CAPI explicit and removes delivery actions', () => {
		render(
			<OutboxLogList
				deliveryDisabled
				processingConversions={false}
				onProcessConversions={jest.fn()}
				onRequeueEvent={jest.fn()}
				conversions={[
					{
						id: 'row-1',
						event_name: 'Purchase',
						event_id: 'technical-event-id',
						value: 899,
						currency: 'MXN',
						status: 'skipped',
						attempt_count: 0,
						created_at: '2026-07-09T12:00:00.000Z',
						last_error_message: 'Delivery disabled',
					},
				]}
			/>,
		);

		expect(
			screen.getByText('CAPI está desactivado; no se envían eventos reales a Meta.'),
		).toBeInTheDocument();
		expect(
			screen.getByText('Estos registros son solo diagnósticos y no requieren una acción.'),
		).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Procesar cola' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Reintentar envío' })).not.toBeInTheDocument();
		expect(screen.getByText('Ver detalle técnico')).toBeInTheDocument();
		expect(screen.getByText(/technical-event-id/)).not.toBeVisible();
	});
});
