import { useEffect, useId, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';

interface DraftOptions {
	invitationId: string | null;
	editorUrl: string | null;
	presets: string[];
}

export default function OrderDraftButton({ orderId }: { orderId: string }) {
	const selectId = useId();
	const [options, setOptions] = useState<DraftOptions | null>(null);
	const [themeId, setThemeId] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const endpoint = `/api/dashboard/commercial/orders/${orderId}/draft`;
	useEffect(() => {
		let cancelled = false;
		setOptions(null);
		setThemeId('');
		setError('');
		void dashboardApi
			.get<{ data: DraftOptions }>(endpoint)
			.then((response) => {
				if (cancelled) return;
				if (response.ok) setOptions(response.data.data);
				else setError(response.message || 'No se pudo consultar el borrador.');
			})
			.catch(() => {
				if (!cancelled) setError('No se pudo consultar el borrador.');
			});
		return () => {
			cancelled = true;
		};
	}, [endpoint]);
	async function createDraft() {
		if (busy || !themeId) return;
		setBusy(true);
		setError('');
		try {
			const response = await dashboardApi.post<{
				data: { invitationId: string; editorUrl: string };
			}>(endpoint, { themeId });
			if (!response.ok) {
				setError(response.message || 'No se pudo crear el borrador.');
				return;
			}
			setOptions({ ...response.data.data, presets: [] });
			window.location.assign(response.data.data.editorUrl);
		} catch {
			setError('No se pudo crear el borrador. Intente de nuevo.');
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className="invitation-data-panel__draft">
			{options?.editorUrl ? (
				<a className="btn-primary" href={options.editorUrl}>
					Abrir borrador
				</a>
			) : (
				options && (
					<>
						<label htmlFor={selectId}>Diseño de la invitación</label>
						<select
							id={selectId}
							value={themeId}
							disabled={busy}
							onChange={(event) => setThemeId(event.target.value)}
						>
							<option value="">Seleccione el diseño</option>
							{(options.presets ?? []).map((preset) => (
								<option key={preset} value={preset}>
									{preset
										.split('-')
										.map((word) => word[0].toUpperCase() + word.slice(1))
										.join(' ')}
								</option>
							))}
						</select>
						<button
							className="btn-primary"
							type="button"
							disabled={!themeId || busy}
							onClick={() => void createDraft()}
						>
							{busy ? 'Creando…' : 'Crear borrador'}
						</button>
					</>
				)
			)}
			{error && (
				<p className="crm-inline-error" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
