import React, { useCallback, useEffect, useState } from 'react';
import type { ClaimCodeDTO } from '@/interfaces/rsvp/domain.interface';
import { adminApi } from '@/lib/dashboard/admin-api';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import ClaimCodesTable from './ClaimCodesTable';
import ClaimCodeFormModal from './ClaimCodeFormModal';

const ClaimCodesApp: React.FC = () => {
	const [items, setItems] = useState<ClaimCodeDTO[]>([]);
	const [error, setError] = useState('');
	const [lastPlainCode, setLastPlainCode] = useState('');
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		setError('');
		setLoading(true);
		try {
			const result = await adminApi.listClaimCodes();
			setItems(result.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const handleCreate = async (payload: {
		eventId: string;
		maxUses: number;
		expiresAt: string | null;
	}) => {
		setError('');
		try {
			const result = await adminApi.createClaimCode(payload);
			setLastPlainCode(result.plainCode);
			await load();
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'No se pudo crear claim code.');
		}
	};

	const handleDisable = async (claimCodeId: string) => {
		try {
			await adminApi.disableClaimCode(claimCodeId);
			await load();
		} catch (err) {
			throw new Error(
				err instanceof Error ? err.message : 'No se pudo desactivar claim code.',
			);
		}
	};

	return (
		<section className="dashboard-main">
			<div className="dashboard-card">
				<h2>Generar Claim Code</h2>
				<p>
					El código plano se muestra una sola vez. Guarda el valor al momento de creación.
				</p>
				<ClaimCodeFormModal onCreate={handleCreate} />
				{lastPlainCode && (
					<p>
						Código generado (copia ahora): <strong>{lastPlainCode}</strong>
					</p>
				)}
				{error && <p className="dashboard-error">{error}</p>}
			</div>

			{loading && <p className="dashboard-status">Cargando...</p>}
			<ClaimCodesTable items={items} onDisable={handleDisable} onRefresh={load} />
		</section>
	);
};

const ClaimCodesAppWithErrorBoundary: React.FC = () => (
	<ErrorBoundary>
		<ClaimCodesApp />
	</ErrorBoundary>
);

export default ClaimCodesAppWithErrorBoundary;
