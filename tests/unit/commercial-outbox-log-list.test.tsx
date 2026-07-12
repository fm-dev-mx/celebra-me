import { fireEvent, render, screen } from '@testing-library/react';

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
		expect(screen.queryByRole('button', { name: 'Recuperar evento' })).not.toBeInTheDocument();
		expect(screen.getByText('Ver detalle técnico')).toBeInTheDocument();
		expect(screen.getByText(/technical-event-id/)).not.toBeVisible();
	});

	it('requires reason and confirmation before requesting recovery', () => {
		const onRecover = jest.fn();
		jest.spyOn(window, 'prompt').mockReturnValue('Revisión aprobada por operación');
		jest.spyOn(window, 'confirm').mockReturnValue(true);
		render(
			<OutboxLogList
				deliveryDisabled={false}
				processingConversions={false}
				onProcessConversions={jest.fn()}
				onRequeueEvent={onRecover}
				conversions={[
					{
						id: 'failed-row',
						event_name: 'Purchase',
						event_id: 'purchase:order:deposit_paid',
						value: 899,
						currency: 'MXN',
						status: 'failed',
						attempt_count: 2,
						created_at: '2026-07-11T12:00:00.000Z',
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Recuperar evento' }));
		expect(onRecover).toHaveBeenCalledWith('failed-row', 'Revisión aprobada por operación');
	});

	it('never exposes recovery for sent events', () => {
		render(
			<OutboxLogList
				deliveryDisabled={false}
				processingConversions={false}
				onProcessConversions={jest.fn()}
				onRequeueEvent={jest.fn()}
				conversions={[
					{
						id: 'sent-row',
						event_name: 'Purchase',
						event_id: 'purchase:sent:deposit_paid',
						value: 899,
						currency: 'MXN',
						status: 'sent',
						attempt_count: 1,
						created_at: '2026-07-11T12:00:00.000Z',
					},
				]}
			/>,
		);
		expect(screen.queryByRole('button', { name: 'Recuperar evento' })).not.toBeInTheDocument();
	});
});
