import { useEffect, useRef, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type { QuoteReminderItem } from '@/lib/commercial/quote-reminders';
import type { CrmTimelineEntry } from '@/lib/commercial/crm-timeline.service';

export default function QuoteReminders({
	onPrepared,
}: {
	onPrepared: (leadId: string, entry: CrmTimelineEntry) => void;
}) {
	const [items, setItems] = useState<QuoteReminderItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState<string | null>(null);
	const [draft, setDraft] = useState<{ whatsappUrl: string; leadId: string } | null>(null);
	const onPreparedRef = useRef(onPrepared);
	onPreparedRef.current = onPrepared;
	const load = async () => {
		setLoading(true);
		setError('');
		try {
			const result = await dashboardApi.get<{ data: QuoteReminderItem[] }>(
				'/api/dashboard/commercial/quote-reminders',
			);
			if (result.ok) setItems(result.data.data);
			else setError(result.message);
		} catch {
			setError('No se pudieron cargar las cotizaciones.');
		} finally {
			setLoading(false);
		}
	};
	useEffect(() => {
		void load();
	}, []);
	const prepare = async (item: QuoteReminderItem) => {
		// Reserve the tab during the click so the async audit cannot trigger popup blocking.
		const tab = window.open('about:blank', '_blank');
		if (tab) tab.opener = null;
		setBusy(item.id);
		setError('');
		setDraft(null);
		try {
			const result = await dashboardApi.post<{
				data: { whatsappUrl: string; entry: CrmTimelineEntry };
			}>('/api/dashboard/commercial/quote-reminders', {
				leadId: item.id,
			});
			if (!result.ok) {
				tab?.close();
				setError(result.message);
				return;
			}
			const { whatsappUrl, entry } = result.data.data;
			setDraft({ whatsappUrl, leadId: item.id });
			setItems((current) => current.filter((row) => row.id !== item.id));
			onPreparedRef.current(item.id, entry);
			if (tab) tab.location.href = whatsappUrl;
		} catch {
			tab?.close();
			setError('No se pudo confirmar el registro. Actualice la lista antes de reintentar.');
		} finally {
			setBusy(null);
		}
	};
	return (
		<section className="dashboard-card" aria-labelledby="quote-reminders-title">
			<h3 id="quote-reminders-title">Cotizaciones sin respuesta</h3>
			<p>
				Sin actividad registrada en 3 días o más. Cada recordatorio abre un borrador para
				que usted lo envíe manualmente.
			</p>
			<button
				type="button"
				className="btn-secondary"
				disabled={loading || Boolean(busy)}
				onClick={() => void load()}
			>
				Actualizar cotizaciones
			</button>
			{error && <p role="alert">{error}</p>}
			{loading ? (
				<p role="status">Cargando cotizaciones…</p>
			) : (
				<ul className="commercial-dashboard__list commercial-dashboard__list--quote-reminders">
					{items.map((item) => (
						<li key={item.id}>
							<div>
								<strong>{item.name || 'Prospecto sin nombre'}</strong>
								<p>
									{item.leadCode} · Última actividad:{' '}
									{new Date(item.lastActivityAt).toLocaleDateString('es-MX')}
								</p>
								{!item.canRemind && (
									<p>
										Requiere permiso de contacto y teléfono con código de país.
									</p>
								)}
							</div>
							<button
								type="button"
								className="btn-secondary"
								disabled={!item.canRemind || Boolean(busy)}
								onClick={() => void prepare(item)}
							>
								{busy === item.id ? 'Preparando…' : 'Enviar recordatorio'}
							</button>
						</li>
					))}
				</ul>
			)}
			{!loading && !error && !items.length && (
				<p>No hay cotizaciones pendientes de recordatorio.</p>
			)}
			{draft && (
				<p role="status">
					Borrador preparado; envío manual pendiente.{' '}
					<a
						className="btn-secondary"
						href={draft.whatsappUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						Abrir borrador de WhatsApp
					</a>
				</p>
			)}
		</section>
	);
}
