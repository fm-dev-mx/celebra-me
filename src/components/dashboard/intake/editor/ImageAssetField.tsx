import type { AssetField } from '@/lib/assets/asset-source';
import { resolveFrozenSrc, resolveSrc } from '@/lib/assets/asset-utils';
import {
	getCommonAsset,
	getEventAsset,
	isCommonAssetKey,
	isEventAssetKey,
} from '@/lib/assets/asset-registry';

type ImageDisplayState = 'empty' | 'selected' | 'default' | 'missing';

interface DefaultPreviewInfo {
	src: string;
	label?: string;
}

interface Props {
	label: string;
	value: AssetField;
	onOpenLibrary: () => void;
	description?: string;
	emptyActionLabel?: string;
	changeActionLabel?: string;
	assetLookupSlug?: string;
	assets?: { id: string; src: string; displayName?: string }[];
	defaultPreview?: DefaultPreviewInfo;
	isDefaultImage?: boolean;
}

function resolvePreviewSrc(
	value: AssetField,
	assetLookupSlug: string | undefined,
	assets: { id: string; src: string; displayName?: string }[],
): string | undefined {
	if (!value) return undefined;
	if (typeof value === 'string') {
		if (value.startsWith('/') || value.startsWith('https://')) return value;
		if (assetLookupSlug && isEventAssetKey(value)) {
			return getEventAsset(assetLookupSlug, value)?.src;
		}
		if (isCommonAssetKey(value)) {
			return resolveSrc(getCommonAsset(value));
		}
		return undefined;
	}
	if (value.type === 'external') return value.src;
	if (value.type === 'uploaded') {
		const asset = assets.find((item) => item.id === value.assetId);
		return asset?.src ?? resolveFrozenSrc(value as unknown as Record<string, unknown>);
	}
	if (isEventAssetKey(value.key)) {
		return assetLookupSlug ? getEventAsset(assetLookupSlug, value.key)?.src : undefined;
	}
	return resolveSrc(getCommonAsset(value.key));
}

function deriveDisplayState(
	value: AssetField,
	src: string | undefined,
	defaultPreview: DefaultPreviewInfo | undefined,
	isDefaultImage?: boolean,
): ImageDisplayState {
	if (value && isDefaultImage) return 'default';
	if (!value) {
		if (defaultPreview) return 'default';
		return 'empty';
	}
	if (src) return 'selected';
	return 'missing';
}

function labelForDisplayState(state: ImageDisplayState): string {
	switch (state) {
		case 'empty':
			return 'Sin imagen';
		case 'selected':
			return 'Imagen seleccionada';
		case 'default':
			return 'Imagen predeterminada';
		case 'missing':
			return 'Imagen faltante';
	}
}

export default function ImageAssetField({
	label,
	value,
	onOpenLibrary,
	description,
	emptyActionLabel = 'Seleccionar imagen',
	changeActionLabel = 'Cambiar imagen',
	assetLookupSlug,
	assets = [],
	defaultPreview,
	isDefaultImage = false,
}: Props) {
	const hasValue = value != null;

	const src = hasValue ? resolvePreviewSrc(value, assetLookupSlug, assets) : defaultPreview?.src;

	const displayState = deriveDisplayState(value, src, defaultPreview, isDefaultImage);
	const actionLabel = hasValue ? changeActionLabel : emptyActionLabel;

	return (
		<div className="invitation-editor__image-field">
			<div className="invitation-editor__image-field-label">{label}</div>
			{description && <p className="invitation-editor__image-field-desc">{description}</p>}
			<div
				className={`invitation-editor__image-card${
					hasValue ? ' invitation-editor__image-card--selected' : ''
				}${displayState === 'default' ? ' invitation-editor__image-card--default' : ''}`}
			>
				<div className="invitation-editor__image-preview">
					{src ? (
						<img src={src} alt={label} loading="lazy" decoding="async" />
					) : (
						<span className="invitation-editor__image-placeholder" aria-hidden="true">
							IMG
						</span>
					)}
				</div>
				<div className="invitation-editor__image-copy">
					<span className="invitation-editor__image-meta">
						{labelForDisplayState(displayState)}
					</span>
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
