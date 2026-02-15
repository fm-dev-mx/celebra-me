import React, { useCallback, useEffect, useState } from 'react';
import type { ClaimCodeDTO } from '@/lib/rsvp-v2/types';
import ClaimCodesTable from './ClaimCodesTable';
import ClaimCodeFormModal from './ClaimCodeFormModal';

interface ClaimCodeCreateResponse {
	plainCode: string;
	item: ClaimCodeDTO;
}

const ClaimCodesApp: React.FC = () => {
	const [items, setItems] = useState<ClaimCodeDTO[]>([]);
	const [error, setError] = useState('');
	const [lastPlainCode, setLastPlainCode] = useState('');

	const load = useCallback(async () => {
		setError('');
		try {
			const response = await fetch('/api/dashboard/claimcodes');
			const data = (await response.json()) as { items: ClaimCodeDTO[]; message?: string };
			if (!response.ok) throw new Error(data.message || 'No se pudo cargar claim codes.');
			setItems(data.items || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	return (
		<section className="dashboard-main">
			<div className="dashboard-card">
				<h2>Generar Claim Code</h2>
				<p>
					El código plano se muestra una sola vez. Guarda el valor al momento de creación.
				</p>
				<ClaimCodeFormModal
					onCreate={async (payload) => {
						setError('');
						const response = await fetch('/api/dashboard/claimcodes', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(payload),
						});
						const data = (await response.json()) as ClaimCodeCreateResponse & {
							message?: string;
						};
						if (!response.ok) {
							throw new Error(data.message || 'No se pudo crear claim code.');
						}
						setLastPlainCode(data.plainCode);
						await load();
					}}
				/>
				{lastPlainCode && (
					<p>
						Código generado (copia ahora): <strong>{lastPlainCode}</strong>
					</p>
				)}
				{error && <p className="dashboard-guests__error">{error}</p>}
			</div>

			<ClaimCodesTable
				items={items}
				onDisable={async (claimCodeId) => {
					const response = await fetch(
						`/api/dashboard/claimcodes/${encodeURIComponent(claimCodeId)}`,
						{
							method: 'DELETE',
						},
					);
					const data = (await response.json()) as { message?: string };
					if (!response.ok) {
						throw new Error(data.message || 'No se pudo desactivar claim code.');
					}
					await load();
				}}
			/>
		</section>
	);
};

export default ClaimCodesApp;
