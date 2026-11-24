import { useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import AssetUploader from '@/components/dashboard/intake/editor/AssetUploader';
import { useAssetLibrary } from '@/lib/intake/use-asset-library';
import { getCsrfToken } from '@/lib/csrf';
import { goToLoginAfterSessionEnded } from '@/lib/dashboard/session-ended';
import {
	getAssetUsageLabel,
	EMPTY_ASSET_LIBRARY_COPY,
	BUNDLED_ASSET_LABEL,
} from '@/lib/intake/labels';

interface Props {
	invitationId: string;
	onSelect: (assetId: string) => void;
	onClose: () => void;
}

export default function AssetPicker({ invitationId, onSelect, onClose }: Props) {
	const [importingId, setImportingId] = useState<string | null>(null);
	const [importError, setImportError] = useState('');
	const { assets, loading, error, refresh: fetchAssets } = useAssetLibrary(invitationId);

	async function handleSelect(asset: {
		id: string;
		isBundled?: boolean;
		bundledKey?: string;
		displayName: string;
	}) {
		if (asset.isBundled) {
			setImportError('');
			setImportingId(asset.id);
			try {
				const csrfToken = getCsrfToken();
				const response = await fetch(
					`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets/import-bundled`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
						},
						body: JSON.stringify({ bundledKey: asset.bundledKey }),
					},
				);
				if (response.status === 401) {
					goToLoginAfterSessionEnded();
					return;
				}
				const result = await response.json();
				if (!response.ok) {
					throw new Error(result?.error?.message || 'Error al importar imagen incluida.');
				}
				onSelect(result.assetId);
			} catch (err) {
				setImportError(err instanceof Error ? err.message : 'Error de red.');
				return;
			} finally {
				setImportingId(null);
			}
		} else {
			onSelect(asset.id);
		}
	}

	return (
		<ModalShell
			title="Biblioteca de imágenes"
			size="lg"
			className="asset-picker"
			onClose={onClose}
			disableClose={importingId !== null}
		>
			<div className="dashboard-modal__content" aria-busy={loading || importingId !== null}>
				<AssetUploader invitationId={invitationId} onUploaded={fetchAssets} />

				{loading && (
					<p className="asset-picker__status" role="status">
						Cargando biblioteca...
					</p>
				)}
				{error && (
					<p className="asset-picker__error" role="alert">
						{error}
					</p>
				)}
				{importError && (
					<p className="asset-picker__error" role="alert">
						{importError}
					</p>
				)}

				{!loading && !error && assets.length === 0 && (
					<div className="asset-picker__empty" role="status">
						<p>{EMPTY_ASSET_LIBRARY_COPY.heading}</p>
						<p>{EMPTY_ASSET_LIBRARY_COPY.subtext}</p>
					</div>
				)}

				{!loading && !error && assets.length > 0 && (
					<ul className="asset-picker__grid" aria-label="Imágenes disponibles">
						{assets.map((asset) => {
							const isBundled = asset.isBundled ?? false;
							const isImporting = importingId === asset.id;
							return (
								<li key={asset.id} className="asset-picker__item-wrapper">
									<button
										className={`asset-picker__item${isBundled ? ' asset-picker__item--bundled' : ''}`}
										type="button"
										onClick={() => handleSelect(asset)}
										disabled={isImporting}
										aria-busy={isImporting}
										aria-label={`Seleccionar ${asset.displayName}`}
									>
										<img
											src={asset.src}
											alt=""
											className="asset-picker__thumbnail"
											loading="lazy"
											decoding="async"
										/>
										<span className="asset-picker__name">
											{isImporting ? 'Copiando...' : asset.displayName}
										</span>
										<span
											className={`asset-picker__badge asset-picker__badge--${
												isBundled
													? 'bundled'
													: asset.usage.usedInDraft
														? 'draft'
														: asset.usage.usedInPublished
															? 'published'
															: 'unused'
											}`}
										>
											{isBundled
												? BUNDLED_ASSET_LABEL
												: getAssetUsageLabel(
														asset.usage.usedInDraft,
														asset.usage.usedInPublished,
													)}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</ModalShell>
	);
}
