import { useState } from 'react';
import AssetUploader from '@/components/dashboard/intake/editor/AssetUploader';
import { getCsrfToken } from '@/lib/csrf';
import { useAssetLibrary } from '@/lib/intake/use-asset-library';
import { getAssetUsageLabel, EMPTY_ASSET_LIBRARY_COPY } from '@/lib/intake/labels';

interface Props {
	invitationId: string;
}

function buildConflictMessage(
	details: { sectionRefs?: string[] } | undefined,
	fallback: string,
): string {
	const refs = details?.sectionRefs?.filter(Boolean) ?? [];
	if (refs.length === 0) return fallback;
	return [
		'No se puede eliminar esta imagen porque está siendo utilizada.',
		`Usos detectados: ${refs.join(', ')}.`,
		'Primero quítala de esas secciones y vuelve a intentarlo.',
	].join('\n');
}

export default function AssetLibraryPanel({ invitationId }: Props) {
	const { assets, loading, error, refresh: fetchAssets } = useAssetLibrary(invitationId);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

	async function handleDelete(asset: { id: string; displayName: string }) {
		setItemErrors((prev) => {
			if (!prev[asset.id]) return prev;
			const next = { ...prev };
			delete next[asset.id];
			return next;
		});
		setActionMessage(null);
		setPendingId(asset.id);

		try {
			const csrfToken = getCsrfToken();
			const response = await fetch(
				`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets/${encodeURIComponent(asset.id)}`,
				{
					method: 'DELETE',
					headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
				},
			);
			const result = await response.json();
			if (!response.ok) {
				const details = result?.error?.details as { sectionRefs?: string[] } | undefined;
				const message = result?.error?.message || 'No se pudo eliminar la imagen.';
				setItemErrors((prev) => ({
					...prev,
					[asset.id]: buildConflictMessage(details, message),
				}));
				return;
			}
			setActionMessage('Imagen archivada correctamente.');
			fetchAssets();
		} catch {
			setItemErrors((prev) => ({
				...prev,
				[asset.id]: 'Error de red al eliminar la imagen.',
			}));
		} finally {
			setPendingId(null);
		}
	}

	return (
		<section
			className="asset-library"
			aria-labelledby="asset-library-title"
			aria-busy={loading || pendingId !== null}
		>
			<h3 id="asset-library-title">Biblioteca de imágenes</h3>
			<p className="asset-library__hint">
				Quitar de una sección no elimina la imagen de la biblioteca. Eliminar de la
				biblioteca solo archiva la imagen si no está en uso.
			</p>

			<AssetUploader invitationId={invitationId} onUploaded={fetchAssets} />

			{loading && (
				<p className="asset-library__status" role="status">
					Cargando biblioteca...
				</p>
			)}
			{error && (
				<p className="asset-library__error" role="alert">
					{error}
				</p>
			)}
			{actionMessage && (
				<p className="asset-library__action asset-library__action--success" role="status">
					{actionMessage}
				</p>
			)}

			{!loading && !error && assets.length === 0 && (
				<div className="asset-library__empty" role="status">
					<p>{EMPTY_ASSET_LIBRARY_COPY.heading}</p>
					<p>{EMPTY_ASSET_LIBRARY_COPY.subtext}</p>
				</div>
			)}

			{assets.length > 0 && (
				<ul className="asset-library__list">
					{assets.map((asset) => {
						const inUse = asset.usage.usedInDraft || asset.usage.usedInPublished;
						const itemError = itemErrors[asset.id];
						return (
							<li
								key={asset.id}
								className={`asset-library__item${inUse ? ' asset-library__item--in-use' : ''}`}
							>
								<img
									src={asset.src}
									alt={asset.displayName}
									className="asset-library__thumbnail"
									loading="lazy"
									decoding="async"
								/>
								<div className="asset-library__info">
									<span className="asset-library__name">{asset.displayName}</span>
									<span
										className={`asset-library__usage ${
											inUse
												? 'asset-library__usage--active'
												: 'asset-library__usage--inactive'
										}`}
									>
										{getAssetUsageLabel(
											asset.usage.usedInDraft,
											asset.usage.usedInPublished,
										)}
									</span>
								</div>
								<button
									className="asset-library__delete"
									type="button"
									onClick={() => handleDelete(asset)}
									disabled={inUse || pendingId === asset.id}
									aria-busy={pendingId === asset.id}
									aria-label={
										pendingId === asset.id
											? `Archivando ${asset.displayName}`
											: inUse
												? `No se puede archivar ${asset.displayName}: está siendo utilizada`
												: `Archivar ${asset.displayName}`
									}
									title={
										inUse
											? 'No se puede eliminar: la imagen está siendo utilizada'
											: pendingId === asset.id
												? 'Archivando...'
												: 'Archivar imagen'
									}
								>
									{pendingId === asset.id ? 'Archivando...' : 'Eliminar'}
								</button>
								{itemError && (
									<p
										className="asset-library__item-error"
										role="alert"
										aria-live="polite"
									>
										{itemError}
									</p>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
