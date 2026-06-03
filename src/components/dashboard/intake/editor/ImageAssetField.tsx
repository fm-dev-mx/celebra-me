import type { EditableAssetSource, AssetField } from '@/lib/assets/asset-source';
import { resolveSrc } from '@/lib/assets/asset-utils';
import {
	getCommonAsset,
	getEventAsset,
	isCommonAssetKey,
	isEventAssetKey,
} from '@/lib/assets/asset-registry';

interface Props {
	label: string;
	value: AssetField;
	onOpenLibrary: () => void;
	emptyActionLabel?: string;
	changeActionLabel?: string;
	previewSlug?: string;
	assets?: { id: string; src: string; displayName?: string }[];
}

interface PreviewInfo {
	src?: string;
	meta: string;
}

function resolveStringPreview(value: string, previewSlug?: string): PreviewInfo {
	if (value.startsWith('/') || value.startsWith('https://')) {
		return { src: value, meta: 'Imagen personalizada' };
	}
	if (previewSlug && isEventAssetKey(value)) {
		return { src: getEventAsset(previewSlug, value)?.src, meta: 'Imagen de demo' };
	}
	if (isCommonAssetKey(value)) {
		return { src: resolveSrc(getCommonAsset(value)), meta: 'Imagen de demo' };
	}
	return { meta: value };
}

function resolveObjectPreview(
	value: EditableAssetSource,
	previewSlug: string | undefined,
	assets: { id: string; src: string; displayName?: string }[],
): PreviewInfo {
	if (value.type === 'external') return { src: value.src, meta: 'Imagen personalizada' };
	if (value.type === 'uploaded') {
		const asset = assets.find((item) => item.id === value.assetId);
		return {
			src: asset?.src,
			meta: asset?.displayName || 'Biblioteca',
		};
	}
	if (isEventAssetKey(value.key)) {
		return {
			src: previewSlug ? getEventAsset(previewSlug, value.key)?.src : undefined,
			meta: 'Imagen de demo',
		};
	}
	return { src: resolveSrc(getCommonAsset(value.key)), meta: 'Imagen de demo' };
}

function resolvePreview(
	value: AssetField,
	previewSlug: string | undefined,
	assets: { id: string; src: string; displayName?: string }[],
): PreviewInfo {
	if (!value) return { meta: 'Sin imagen' };
	if (typeof value === 'string') return resolveStringPreview(value, previewSlug);
	return resolveObjectPreview(value, previewSlug, assets);
}

export default function ImageAssetField({
	label,
	value,
	onOpenLibrary,
	emptyActionLabel = 'Seleccionar imagen',
	changeActionLabel = 'Cambiar imagen',
	previewSlug,
	assets = [],
}: Props) {
	const hasValue = value != null;
	const preview = resolvePreview(value, previewSlug, assets);
	const actionLabel = hasValue ? changeActionLabel : emptyActionLabel;

	return (
		<div className="invitation-editor__image-field">
			<div className="invitation-editor__image-field-label">{label}</div>
			<div
				className={`invitation-editor__image-card${
					hasValue ? ' invitation-editor__image-card--selected' : ''
				}`}
			>
				<div className="invitation-editor__image-preview">
					{preview.src ? (
						<img src={preview.src} alt={label} loading="lazy" decoding="async" />
					) : (
						<span aria-hidden="true">IMG</span>
					)}
				</div>
				<div className="invitation-editor__image-copy">
					<strong>{hasValue ? 'Imagen seleccionada' : 'Sin imagen seleccionada'}</strong>
					<span>{preview.meta}</span>
				</div>
				<button
					type="button"
					className="invitation-editor__image-action"
					onClick={onOpenLibrary}
				>
					{actionLabel}
				</button>
			</div>
		</div>
	);
}
