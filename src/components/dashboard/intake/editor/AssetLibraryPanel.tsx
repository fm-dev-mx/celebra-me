import AssetUploader from '@/components/dashboard/intake/editor/AssetUploader';
import { getCsrfToken } from '@/lib/csrf';
import { useAssetLibrary } from '@/lib/intake/use-asset-library';

interface Props {
	invitationId: string;
}

export default function AssetLibraryPanel({ invitationId }: Props) {
	const { assets, loading, error, refresh: fetchAssets } = useAssetLibrary(invitationId);

	async function handleDelete(assetId: string) {
		try {
			const csrfToken = getCsrfToken();
			const response = await fetch(
				`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets/${encodeURIComponent(assetId)}`,
				{
					method: 'DELETE',
					headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
				},
			);
			const result = await response.json();
			if (!response.ok) {
				const msg = result?.error?.message || 'No se pudo eliminar la imagen.';
				alert(msg);
				return;
			}
			fetchAssets();
		} catch {
			alert('Error de red al eliminar la imagen.');
		}
	}

	return (
		<div className="asset-library">
			<h3>Biblioteca de imágenes</h3>

			<AssetUploader invitationId={invitationId} onUploaded={fetchAssets} />

			{loading && <p>Cargando...</p>}
			{error && <p className="asset-library__error">{error}</p>}

			{!loading && !error && assets.length === 0 && (
				<p className="asset-library__empty">Aún no hay imágenes subidas.</p>
			)}

			<ul className="asset-library__list">
				{assets.map((asset) => (
					<li key={asset.id} className="asset-library__item">
						<img
							src={asset.src}
							alt={asset.displayName}
							className="asset-library__thumbnail"
							loading="lazy"
						/>
						<div className="asset-library__info">
							<span className="asset-library__name">{asset.displayName}</span>
							<span className="asset-library__usage">
								{asset.usage.usedInDraft && asset.usage.usedInPublished
									? 'Borrador y publicación'
									: asset.usage.usedInDraft
										? 'Borrador'
										: asset.usage.usedInPublished
											? 'Publicación'
											: 'No utilizado'}
							</span>
						</div>
						<button
							className="asset-library__delete"
							type="button"
							onClick={() => handleDelete(asset.id)}
							disabled={asset.usage.usedInDraft || asset.usage.usedInPublished}
							title={
								asset.usage.usedInDraft || asset.usage.usedInPublished
									? 'No se puede eliminar: la imagen está siendo utilizada'
									: 'Eliminar de la biblioteca'
							}
						>
							Eliminar
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
