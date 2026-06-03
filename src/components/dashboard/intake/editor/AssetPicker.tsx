import { useEffect, useRef } from 'react';
import AssetUploader from '@/components/dashboard/intake/editor/AssetUploader';
import { useAssetLibrary } from '@/lib/intake/use-asset-library';
import { getAssetUsageLabel, EMPTY_ASSET_LIBRARY_COPY } from '@/lib/intake/labels';

interface Props {
	invitationId: string;
	onSelect: (assetId: string) => void;
	onClose: () => void;
}

export default function AssetPicker({ invitationId, onSelect, onClose }: Props) {
	const { assets, loading, error, refresh: fetchAssets } = useAssetLibrary(invitationId);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const previouslyFocused = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previouslyFocused.current = document.activeElement as HTMLElement | null;
		closeButtonRef.current?.focus();
		return () => {
			previouslyFocused.current?.focus?.();
		};
	}, []);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
			}
		}
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onClose]);

	function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	return (
		<div
			className="asset-picker-overlay"
			onClick={handleOverlayClick}
			role="dialog"
			aria-modal="true"
			aria-labelledby="asset-picker-title"
		>
			<div
				className="asset-picker"
				onClick={(event) => event.stopPropagation()}
				aria-busy={loading}
			>
				<div className="asset-picker__header">
					<h3 id="asset-picker-title">Biblioteca de imágenes</h3>
					<button
						ref={closeButtonRef}
						className="asset-picker__close"
						type="button"
						onClick={onClose}
						aria-label="Cerrar selector de imágenes"
					>
						Cerrar
					</button>
				</div>

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

				{!loading && !error && assets.length === 0 && (
					<div className="asset-picker__empty" role="status">
						<p>{EMPTY_ASSET_LIBRARY_COPY.heading}</p>
						<p>{EMPTY_ASSET_LIBRARY_COPY.subtext}</p>
					</div>
				)}

				{!loading && !error && assets.length > 0 && (
					<ul className="asset-picker__grid" aria-label="Imágenes disponibles">
						{assets.map((asset) => (
							<li key={asset.id} className="asset-picker__item-wrapper">
								<button
									className="asset-picker__item"
									type="button"
									onClick={() => onSelect(asset.id)}
									aria-label={`Seleccionar ${asset.displayName}`}
								>
									<img
										src={asset.src}
										alt=""
										className="asset-picker__thumbnail"
										loading="lazy"
										decoding="async"
									/>
									<span className="asset-picker__name">{asset.displayName}</span>
									<span
										className={`asset-picker__badge asset-picker__badge--${
											asset.usage.usedInDraft
												? 'draft'
												: asset.usage.usedInPublished
													? 'published'
													: 'unused'
										}`}
									>
										{getAssetUsageLabel(
											asset.usage.usedInDraft,
											asset.usage.usedInPublished,
										)}
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
