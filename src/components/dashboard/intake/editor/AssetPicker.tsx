import { useEffect, useRef, useState } from 'react';
import AssetUploader from '@/components/dashboard/intake/editor/AssetUploader';
import { useAssetLibrary } from '@/lib/intake/use-asset-library';
import { getCsrfToken } from '@/lib/csrf';
import {
	getAssetUsageLabel,
	EMPTY_ASSET_LIBRARY_COPY,
	DEMO_ASSET_LABEL,
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

	async function handleSelect(asset: {
		id: string;
		isDemo?: boolean;
		demoKey?: string;
		displayName: string;
	}) {
		if (asset.isDemo) {
			setImportingId(asset.id);
			try {
				const csrfToken = getCsrfToken();
				const response = await fetch(
					`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets/import-from-demo`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
						},
						body: JSON.stringify({ demoKey: asset.demoKey }),
					},
				);
				const result = await response.json();
				if (!response.ok) {
					throw new Error(result?.error?.message || 'Error al importar imagen de demo.');
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
				aria-busy={loading || importingId !== null}
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
							const isDemo = asset.isDemo ?? false;
							const isImporting = importingId === asset.id;
							return (
								<li key={asset.id} className="asset-picker__item-wrapper">
									<button
										className={`asset-picker__item${isDemo ? ' asset-picker__item--demo' : ''}`}
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
												isDemo
													? 'demo'
													: asset.usage.usedInDraft
														? 'draft'
														: asset.usage.usedInPublished
															? 'published'
															: 'unused'
											}`}
										>
											{isDemo
												? DEMO_ASSET_LABEL
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
		</div>
	);
}
