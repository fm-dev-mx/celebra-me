import { useEffect, useState } from 'react';
import { VALENTINA_MEMORIES_MAX_CAPTION_LENGTH } from '@/data/valentina-memories-media.contract';

type OrganizerItem = {
	id: string;
	mimeType: string;
	sizeBytes: number;
	durationSeconds: number | null;
	caption: string;
	status: 'uploading' | 'validating' | 'accepted' | 'rejected' | 'deleted';
	createdAt: string;
};

const ENDPOINT = '/api/dashboard/memories/valentina';

const statusLabel: Record<OrganizerItem['status'], string> = {
	uploading: 'Subiendo',
	validating: 'En validación',
	accepted: 'Aprobado',
	rejected: 'Rechazado',
	deleted: 'Eliminado',
};

export default function ValentinaMemoriesOrganizer() {
	const [items, setItems] = useState<OrganizerItem[]>([]);
	const [statusFilter, setStatusFilter] = useState<'all' | OrganizerItem['status']>('all');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [caption, setCaption] = useState('');

	const load = async () => {
		setLoading(true);
		const response = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
		if (!response.ok) {
			setError(
				response.status === 403
					? 'No tiene autorización para este evento.'
					: 'No se pudo cargar la bandeja de recuerdos.',
			);
			setLoading(false);
			return;
		}
		const payload = (await response.json()) as { items?: OrganizerItem[] };
		setItems(Array.isArray(payload.items) ? payload.items : []);
		setError(null);
		setLoading(false);
	};

	useEffect(() => {
		void load();
	}, []);

	const update = async (item: OrganizerItem, body: Record<string, unknown>) => {
		const response = await fetch(`${ENDPOINT}/${encodeURIComponent(item.id)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		if (response.ok) await load();
		else setError('No se pudo actualizar el recuerdo.');
	};

	const remove = async (item: OrganizerItem) => {
		if (!window.confirm('¿Desea eliminar este recuerdo?')) return;
		const response = await fetch(`${ENDPOINT}/${encodeURIComponent(item.id)}`, {
			method: 'DELETE',
		});
		if (response.ok) await load();
		else setError('No se pudo eliminar el recuerdo.');
	};

	const visibleItems =
		statusFilter === 'all' ? items : items.filter((item) => item.status === statusFilter);

	return (
		<section className="dashboard-card dashboard-memories" aria-label="Recuerdos de Valentina">
			<div className="dashboard-card-header">
				<div>
					<h2>Recuerdos de Valentina</h2>
					<p>
						Revise, modere y descargue los archivos aprobados. El acceso está limitado a
						su evento.
					</p>
				</div>
				<button type="button" onClick={() => void load()}>
					Actualizar
				</button>
			</div>
			<div className="dashboard-memories__toolbar">
				<label>
					Estado
					<select
						value={statusFilter}
						onChange={(event) =>
							setStatusFilter(event.target.value as typeof statusFilter)
						}
					>
						<option value="all">Todos</option>
						{Object.entries(statusLabel).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>
			</div>
			{error ? (
				<p role="alert" className="dashboard-memories__error">
					{error}
				</p>
			) : null}
			{loading ? (
				<p>Cargando recuerdos…</p>
			) : visibleItems.length === 0 ? (
				<p>No hay recuerdos para este filtro.</p>
			) : (
				<div className="dashboard-memories__grid">
					{visibleItems.map((item) => (
						<article className="dashboard-memories__item" key={item.id}>
							{item.status === 'accepted' ? (
								item.mimeType.startsWith('video/') ? (
									<video
										controls
										preload="metadata"
										src={`${ENDPOINT}/${encodeURIComponent(item.id)}?mode=preview`}
									/>
								) : (
									<img
										loading="lazy"
										src={`${ENDPOINT}/${encodeURIComponent(item.id)}?mode=preview`}
										alt={item.caption || 'Recuerdo de Valentina'}
									/>
								)
							) : (
								<div className="dashboard-memories__placeholder">
									{statusLabel[item.status]}
								</div>
							)}
							<div className="dashboard-memories__meta">
								<span>{statusLabel[item.status]}</span>
								<small>{new Date(item.createdAt).toLocaleString('es-MX')}</small>
							</div>
							{editingId === item.id ? (
								<div className="dashboard-memories__edit">
									<input
										value={caption}
										maxLength={VALENTINA_MEMORIES_MAX_CAPTION_LENGTH}
										onChange={(event) => setCaption(event.target.value)}
										aria-label="Descripción del recuerdo"
									/>
									<button
										type="button"
										onClick={() => {
											void update(item, { caption }).then(() =>
												setEditingId(null),
											);
										}}
									>
										Guardar
									</button>
								</div>
							) : (
								<p>{item.caption || 'Sin descripción'}</p>
							)}
							<div className="dashboard-memories__actions">
								<button
									type="button"
									onClick={() => {
										setEditingId(item.id);
										setCaption(item.caption);
									}}
								>
									Editar
								</button>
								{item.status === 'validating' || item.status === 'rejected' ? (
									<button
										type="button"
										onClick={() => void update(item, { status: 'accepted' })}
									>
										Aprobar
									</button>
								) : null}
								{item.status === 'validating' || item.status === 'accepted' ? (
									<button
										type="button"
										onClick={() => void update(item, { status: 'rejected' })}
									>
										Rechazar
									</button>
								) : null}
								{item.status === 'accepted' ? (
									<a href={`${ENDPOINT}/${encodeURIComponent(item.id)}`} download>
										Descargar
									</a>
								) : null}
								{item.status !== 'deleted' ? (
									<button type="button" onClick={() => void remove(item)}>
										Eliminar
									</button>
								) : (
									<button
										type="button"
										onClick={() => void update(item, { status: 'validating' })}
									>
										Restaurar
									</button>
								)}
							</div>
						</article>
					))}
				</div>
			)}
		</section>
	);
}
