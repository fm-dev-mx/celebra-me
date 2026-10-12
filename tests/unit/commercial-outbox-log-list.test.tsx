import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import OutboxLogList, {
	type ConversionEvent,
} from '@/components/dashboard/commercial/OutboxLogList';

const FAILED_CONVERSION: ConversionEvent = {
	id: 'failed-row',
	event_name: 'Purchase',
	event_id: 'purchase:order:deposit_paid',
	value: 899,
	currency: 'MXN',
	status: 'failed',
	attempt_count: 2,
	created_at: '2026-07-11T12:00:00.000Z',
};

function renderFailedConversion(
	onRequeueEvent: ComponentProps<typeof OutboxLogList>['onRequeueEvent'],
) {
	render(
		<OutboxLogList
			deliveryDisabled={false}
			processingConversions={false}
			onProcessConversions={jest.fn()}
			onRequeueEvent={onRequeueEvent}
			conversions={[FAILED_CONVERSION]}
		/>,
	);
}

describe('OutboxLogList', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

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

	it('requires reason and modal confirmation before requesting recovery', async () => {
		const onRecover = jest.fn().mockResolvedValue(undefined);
		jest.spyOn(window, 'prompt').mockReturnValue('Revisión aprobada por operación');
		const confirmSpy = jest.spyOn(window, 'confirm');
		renderFailedConversion(onRecover);

		fireEvent.click(screen.getByRole('button', { name: 'Recuperar evento' }));
		expect(onRecover).not.toHaveBeenCalled();

		const dialog = screen.getByRole('dialog');
		expect(within(dialog).getByText(/Revisión aprobada por operación/)).toBeInTheDocument();
		fireEvent.click(within(dialog).getByRole('button', { name: 'Recuperar evento' }));

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(onRecover).toHaveBeenCalledTimes(1);
		expect(onRecover).toHaveBeenCalledWith('failed-row', 'Revisión aprobada por operación');
		expect(confirmSpy).not.toHaveBeenCalled();
	});

	it('keeps the modal busy until the recovery request settles', async () => {
		let resolveRecovery: () => void = () => undefined;
		const onRecover = jest.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveRecovery = resolve;
				}),
		);
		jest.spyOn(window, 'prompt').mockReturnValue('Reintento autorizado');
		renderFailedConversion(onRecover);

		fireEvent.click(screen.getByRole('button', { name: 'Recuperar evento' }));
		fireEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', { name: 'Recuperar evento' }),
		);

		const dialog = screen.getByRole('dialog');
		expect(within(dialog).getByRole('button', { name: 'Procesando...' })).toBeDisabled();
		expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();

		resolveRecovery();
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('requests nothing when the recovery is cancelled', () => {
		const onRecover = jest.fn();
		jest.spyOn(window, 'prompt').mockReturnValue('Revisión aprobada por operación');
		renderFailedConversion(onRecover);

		fireEvent.click(screen.getByRole('button', { name: 'Recuperar evento' }));
		fireEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }),
		);

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(onRecover).not.toHaveBeenCalled();
	});

	it('opens no confirmation when the reason is empty', () => {
		const onRecover = jest.fn();
		jest.spyOn(window, 'prompt').mockReturnValue('   ');
		renderFailedConversion(onRecover);

		fireEvent.click(screen.getByRole('button', { name: 'Recuperar evento' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(onRecover).not.toHaveBeenCalled();
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
