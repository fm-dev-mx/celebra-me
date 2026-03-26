import React from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import ClaimCodeFormModal from '@/components/dashboard/claimcodes/ClaimCodeFormModal';
import ClaimCodesTable from '@/components/dashboard/claimcodes/ClaimCodesTable';
import { useClaimCodesAdmin } from '@/hooks/use-claim-codes-admin';

const ClaimCodesApp: React.FC = () => {
	const {
		items,
		events,
		error,
		lastPlainCode,
		loading,
		eventsLoading,
		createClaimCode,
		updateClaimCode,
		disableClaimCode,
	} = useClaimCodesAdmin();

	return (
		<section className="dashboard-main">
			<div className="dashboard-card">
				<h2>Generar código de acceso</h2>
				<p>
					El código plano se muestra una sola vez. Guarda el valor al momento de crearlo.
				</p>
				<ClaimCodeFormModal
					events={events}
					loading={eventsLoading}
					onCreate={createClaimCode}
				/>
				{lastPlainCode && (
					<p>
						Código generado (copia ahora): <strong>{lastPlainCode}</strong>
					</p>
				)}
				{error && <p className="dashboard-error">{error}</p>}
			</div>

			{loading && <p className="dashboard-status">Cargando...</p>}
			<ClaimCodesTable
				items={items}
				onDisable={disableClaimCode}
				onUpdate={updateClaimCode}
			/>
		</section>
	);
};

const ClaimCodesAppWithErrorBoundary: React.FC = () => (
	<ErrorBoundary>
		<ClaimCodesApp />
	</ErrorBoundary>
);

export default ClaimCodesAppWithErrorBoundary;
