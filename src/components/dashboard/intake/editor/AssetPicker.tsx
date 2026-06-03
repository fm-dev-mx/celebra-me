import AssetUploader from '@/components/dashboard/intake/editor/AssetUploader';
import { useAssetLibrary } from '@/lib/intake/use-asset-library';

interface Props {
	invitationId: string;
	onSelect: (assetId: string) => void;
	onClose: () => void;
}

export default function AssetPicker({ invitationId, onSelect, onClose }: Props) {
	const { assets, loading, error, refresh: fetchAssets } = useAssetLibrary(invitationId);

	return (
		<div className="asset-picker-overlay" onClick={onClose} role="dialog">
			<div className="asset-picker" onClick={(e) => e.stopPropagation()}>
				<div className="asset-picker__header">
					<h3>Biblioteca de imágenes</h3>
					<button className="asset-picker__close" onClick={onClose}>
						Cerrar
					</button>
				</div>

				<AssetUploader invitationId={invitationId} onUploaded={fetchAssets} />

				{loading && <p className="asset-picker__status">Cargando...</p>}
				{error && <p className="asset-picker__error">{error}</p>}

				{!loading && !error && assets.length === 0 && (
					<p className="asset-picker__empty">Aún no hay imágenes subidas.</p>
				)}

				<div className="asset-picker__grid">
					{assets.map((asset) => (
						<button
							key={asset.id}
							className="asset-picker__item"
							type="button"
							onClick={() => onSelect(asset.id)}
						>
							<img
								src={asset.src}
								alt={asset.displayName}
								className="asset-picker__thumbnail"
								loading="lazy"
							/>
							<span className="asset-picker__name">{asset.displayName}</span>
							{asset.usage.usedInDraft && (
								<span className="asset-picker__badge asset-picker__badge--draft">
									Usado en borrador
								</span>
							)}
							{asset.usage.usedInPublished && (
								<span className="asset-picker__badge asset-picker__badge--published">
									Usado en publicación
								</span>
							)}
							{!asset.usage.usedInDraft && !asset.usage.usedInPublished && (
								<span className="asset-picker__badge asset-picker__badge--unused">
									No utilizado
								</span>
							)}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
