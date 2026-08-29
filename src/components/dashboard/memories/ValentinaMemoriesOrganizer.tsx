import { useEffect, useState } from 'react';
import { VALENTINA_MEMORIES_MAX_CAPTION_LENGTH } from '@/data/valentina-memories-media.contract';
import {
	createEncryptedMemoriesZip,
	generateBulkZipPassphrase,
	partitionMemoriesExport,
	type BulkExportProgress,
} from '@/lib/memories/valentina-memories-client';

type OrganizerItem = {
	id: string;
	mimeType: string;
	sizeBytes: number;
	durationSeconds: number | null;
	caption: string;
	status: 'uploading' | 'validating' | 'accepted' | 'rejected' | 'deleted' | 'duplicate';
	createdAt: string;
	uploader: { displayName: string; guestAlias: string };
};

const ENDPOINT = '/api/dashboard/memories/valentina';

const statusLabel: Record<OrganizerItem['status'], string> = {
	uploading: 'Subiendo',
	validating: 'En validación',
	accepted: 'Aprobado',
	rejected: 'Rechazado',
	deleted: 'Eliminado',
	duplicate: 'Duplicado',
};

export default function ValentinaMemoriesOrganizer() {
	const [items, setItems] = useState<OrganizerItem[]>([]);
	const [nextPage, setNextPage] = useState<number | null>(null);
	const [statusFilter, setStatusFilter] = useState<'all' | OrganizerItem['status']>('all');
	const [uploaderFilter, setUploaderFilter] = useState('');
	const [dateFilter, setDateFilter] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [caption, setCaption] = useState('');

	// Bulk export states
	const [exporting, setExporting] = useState(false);
	const [exportPassphrase, setExportPassphrase] = useState<string | null>(null);
	const [exportProgress, setExportProgress] = useState<BulkExportProgress | null>(null);
	const [exportError, setExportError] = useState<string | null>(null);

	const load = async (page = 0, append = false) => {
		setLoading(true);
		const response = await fetch(`${ENDPOINT}?page=${page}`, {
			headers: { Accept: 'application/json' },
		});
		if (!response.ok) {
			setError(
				response.status === 403
					? 'No tiene autorización para este evento.'
					: 'No se pudo cargar la bandeja de recuerdos.',
			);
			setLoading(false);
			return;
		}
		const payload = (await response.json()) as { items?: OrganizerItem[]; nextPage?: unknown };
		const loadedItems = Array.isArray(payload.items) ? payload.items : [];
		setItems((current) => (append ? [...current, ...loadedItems] : loadedItems));
		setNextPage(typeof payload.nextPage === 'number' ? payload.nextPage : null);
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

	const handleBulkExport = async () => {
		let passphrase: string;
		let batches: OrganizerItem[][];
		try {
			let allItems = [...items];
			let page = nextPage;
			while (page !== null) {
				const response = await fetch(`${ENDPOINT}?page=${page}`, {
					headers: { Accept: 'application/json' },
				});
				if (!response.ok) throw new Error('No se pudo cargar todo el catálogo.');
				const payload = (await response.json()) as {
					items?: OrganizerItem[];
					nextPage?: unknown;
				};
				allItems = [...allItems, ...(Array.isArray(payload.items) ? payload.items : [])];
				page = typeof payload.nextPage === 'number' ? payload.nextPage : null;
			}
			setItems(allItems);
			setNextPage(null);
			const acceptedItems = allItems.filter((item) => item.status === 'accepted');
			if (acceptedItems.length === 0) {
				setExportError('No hay recuerdos aprobados para descargar.');
				return;
			}
			passphrase = generateBulkZipPassphrase();
			batches = partitionMemoriesExport(acceptedItems) as OrganizerItem[][];
			setExportProgress({
				completed: 0,
				total: acceptedItems.length,
				currentFileName: 'Iniciando…',
			});
		} catch (caught) {
			setExportError(
				caught instanceof Error ? caught.message : 'No se pudo preparar la descarga.',
			);
			return;
		}
		setExportPassphrase(passphrase);
		setExportError(null);
		setExporting(true);

		try {
			for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
				const blob = await createEncryptedMemoriesZip({
					items: batches[batchIndex],
					passphrase,
					fetchItemBlob: async (item) => {
						const res = await fetch(`${ENDPOINT}/${encodeURIComponent(item.id)}`);
						if (!res.ok) throw new Error('No se pudo descargar uno de los archivos.');
						return await res.blob();
					},
					onProgress: setExportProgress,
				});
				const downloadUrl = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = downloadUrl;
				link.download = `recuerdos-valentina-${new Date().toISOString().slice(0, 10)}-parte-${batchIndex + 1}.zip`;
				document.body.appendChild(link);
				link.click();
				link.remove();
				URL.revokeObjectURL(downloadUrl);
			}
		} catch (err) {
			setExportError(
				err instanceof Error
					? err.message
					: 'Ocurrió un error al generar el archivo comprimido.',
			);
		} finally {
			setExporting(false);
		}
	};

	const normalizedUploaderFilter = uploaderFilter.trim().toLowerCase();
	const visibleItems = items.filter((item) => {
		if (statusFilter !== 'all' && item.status !== statusFilter) return false;
		if (dateFilter && !item.createdAt.startsWith(dateFilter)) return false;
		if (
			normalizedUploaderFilter &&
			!`${item.uploader.displayName} ${item.uploader.guestAlias}`
				.toLowerCase()
				.includes(normalizedUploaderFilter)
		)
			return false;
		return true;
	});

	const revokeUploader = async (item: OrganizerItem) => {
		if (!window.confirm(`¿Desea bloquear futuras cargas de ${item.uploader.displayName}?`))
			return;
		const response = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'revoke_session',
				guestAlias: item.uploader.guestAlias,
			}),
		});
		if (!response.ok) setError('No se pudo bloquear la sesión del invitado.');
	};

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
				<div className="dashboard-memories__header-actions">
					<button type="button" onClick={() => void load()}>
						Actualizar
					</button>
					<button
						type="button"
						onClick={() => void handleBulkExport()}
						disabled={exporting}
					>
						{exporting ? 'Generando .zip…' : 'Descargar todo (.zip cifrado)'}
					</button>
				</div>
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
				<label>
					Invitado
					<input
						value={uploaderFilter}
						onChange={(event) => setUploaderFilter(event.target.value)}
						placeholder="Nombre o alias"
					/>
				</label>
				<label>
					Fecha
					<input
						type="date"
						value={dateFilter}
						onChange={(event) => setDateFilter(event.target.value)}
					/>
				</label>
			</div>
			{error ? (
				<p role="alert" className="dashboard-memories__error">
					{error}
				</p>
			) : null}
			{exportError && !exportPassphrase ? (
				<p role="alert" className="dashboard-memories__error">
					{exportError}
				</p>
			) : null}
			{loading ? (
				<p>Cargando recuerdos…</p>
			) : visibleItems.length === 0 ? (
				<p>No hay recuerdos para este filtro.</p>
			) : (
				<>
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
									<strong>
										{item.uploader.displayName} · {item.uploader.guestAlias}
									</strong>
									<small>
										{new Date(item.createdAt).toLocaleString('es-MX')}
									</small>
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
									{item.status === 'validating' || item.status === 'accepted' ? (
										<button
											type="button"
											onClick={() =>
												void update(item, { status: 'rejected' })
											}
										>
											Rechazar
										</button>
									) : null}
									{item.status === 'accepted' ? (
										<a
											href={`${ENDPOINT}/${encodeURIComponent(item.id)}`}
											download
										>
											Descargar
										</a>
									) : null}
									{item.status !== 'deleted' ? (
										<button type="button" onClick={() => void remove(item)}>
											Eliminar
										</button>
									) : null}
									<button type="button" onClick={() => void revokeUploader(item)}>
										Bloquear sesión
									</button>
								</div>
							</article>
						))}
					</div>
					{nextPage !== null ? (
						<button type="button" onClick={() => void load(nextPage, true)}>
							Cargar más recuerdos
						</button>
					) : null}
				</>
			)}

			{exportPassphrase ? (
				<div className="dashboard-memories__dialog" role="dialog" aria-modal="true">
					<div className="dashboard-memories__dialog-content">
						<h3>Contraseña de su archivo .zip</h3>
						<p>
							El archivo se cifra en su navegador mediante WinZip AES-256. Copie esta
							contraseña antes de cerrar. No se guarda ni se envía al servidor:
						</p>
						<code>{exportPassphrase}</code>
						{exportProgress ? (
							<p>
								Procesando: {exportProgress.completed} de {exportProgress.total} (
								{exportProgress.currentFileName})
							</p>
						) : null}
						{exportError ? (
							<p className="dashboard-memories__error">{exportError}</p>
						) : null}
						<button
							type="button"
							disabled={exporting}
							onClick={() => {
								setExportPassphrase(null);
								setExportProgress(null);
								setExportError(null);
							}}
						>
							Cerrar
						</button>
					</div>
				</div>
			) : null}
		</section>
	);
}
