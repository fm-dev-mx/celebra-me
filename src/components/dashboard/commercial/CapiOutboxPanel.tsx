import React, { useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import OutboxLogList, {
	type ConversionEvent,
} from '@/components/dashboard/commercial/OutboxLogList';

interface CapiOutboxPanelProps {
	initialConversions: ConversionEvent[];
	deliveryDisabled: boolean;
}

interface ProcessResult {
	processed: number;
	failed: number;
	skipped: number;
}

const CapiOutboxPanel: React.FC<CapiOutboxPanelProps> = ({
	initialConversions,
	deliveryDisabled,
}) => {
	const [conversions, setConversions] = useState<ConversionEvent[]>(initialConversions);
	const [processingConversions, setProcessingConversions] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');

	const refreshConversions = async () => {
		try {
			const res = await dashboardApi.get<{ data: ConversionEvent[] }>(
				'/api/dashboard/commercial/meta-conversions/process',
			);
			if (res.ok) {
				setConversions(res.data.data);
			}
		} catch (err) {
			console.error('Error refreshing conversions outbox:', err);
		}
	};

	const handleProcessConversions = async () => {
		setProcessingConversions(true);
		setErrorMessage('');
		setSuccessMessage('');

		try {
			const res = await dashboardApi.post<{ data: ProcessResult }>(
				'/api/dashboard/commercial/meta-conversions/process',
			);

			if (res.ok) {
				const { processed, failed, skipped } = res.data.data;
				setSuccessMessage(
					`Procesamiento completado. Enviados: ${processed}, Fallidos: ${failed}, Ignorados: ${skipped}.`,
				);
				void refreshConversions();
			} else {
				setErrorMessage(res.message || 'Error al procesar las conversiones.');
			}
		} catch (err: unknown) {
			const errMsg =
				err instanceof Error ? err.message : 'Error de red al procesar conversiones.';
			setErrorMessage(errMsg);
		} finally {
			setProcessingConversions(false);
		}
	};

	const handleRequeueEvent = async (eventId: string) => {
		setProcessingConversions(true);
		setErrorMessage('');
		setSuccessMessage('');

		try {
			const res = await dashboardApi.post<{ data: { eventId: string; status: string } }>(
				'/api/dashboard/commercial/meta-conversions/process',
				{
					action: 'requeue',
					eventId,
				},
			);

			if (res.ok) {
				setSuccessMessage(
					`Evento ${res.data.data.eventId} reencolado con éxito. Estado: ${res.data.data.status}`,
				);
				void refreshConversions();
			} else {
				setErrorMessage(res.message || 'Error al reencolar el evento.');
			}
		} catch (err: unknown) {
			const errMsg =
				err instanceof Error ? err.message : 'Error de red al reencolar el evento.';
			setErrorMessage(errMsg);
		} finally {
			setProcessingConversions(false);
		}
	};

	return (
		<>
			{errorMessage && <div className="dashboard-error">{errorMessage}</div>}
			{successMessage && <div className="dashboard-status">{successMessage}</div>}
			<OutboxLogList
				conversions={conversions}
				deliveryDisabled={deliveryDisabled}
				processingConversions={processingConversions}
				onProcessConversions={handleProcessConversions}
				onRequeueEvent={handleRequeueEvent}
			/>
		</>
	);
};

export default CapiOutboxPanel;
