import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import FocalPointControl from '@/components/dashboard/intake/editor/FocalPointControl';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import {
	GALLERY_ROLE_LABELS,
	getGalleryPreviewAspectRatio,
	getGalleryPreviewRole,
} from '@/lib/components/gallery/gallery-presentation';
import { DEVICE_LABELS, type PreviewDevice } from '@/lib/editor/constants';
import { moveArrayItem } from '@/lib/intake/utils';
import { useState } from 'react';
import AssetPicker from '@/components/dashboard/intake/editor/AssetPicker';
import type { AssetItem } from '@/lib/intake/use-asset-library';
import { resolveAssetSrc } from '@/lib/assets/asset-utils';

type Gallery = NonNullable<DraftContent['gallery']>;
type GalleryItem = Gallery['items'][number];

interface Props {
	value: Gallery;
	assetLookupSlug: string;
	onChange: (value: Gallery) => void;
	variant?: string;
	invitationId?: string;
	photoNotes?: NonNullable<DraftContent['photoNotes']>;
	onPhotoNotesChange?: (value: NonNullable<DraftContent['photoNotes']>) => void;
	onSavePhotoNotes?: () => void;
	photoNotesDirty?: boolean;
	savingPhotoNotes?: boolean;
	assets?: AssetItem[];
}

function imageItemKey(image: GalleryItem['image']): string {
	if (typeof image === 'string') return image;
	if (image.type === 'internal') return image.key;
	if (image.type === 'uploaded') return `asset:${image.assetId.slice(0, 8)}`;
	return image.src;
}

export default function GalleryEditor({
	value,
	assetLookupSlug,
	onChange,
	variant,
	invitationId,
	photoNotes = {},
	onPhotoNotesChange = () => undefined,
	onSavePhotoNotes = () => undefined,
	photoNotesDirty = false,
	savingPhotoNotes = false,
	assets = [],
}: Props) {
	const [cropMode, setCropMode] = useState<PreviewDevice>('mobile');
	const [perDeviceMap, setPerDeviceMap] = useState<Record<number, boolean>>({});
	const [pickerIndex, setPickerIndex] = useState<number | null>(null);

	const updateItem = (index: number, patch: Partial<GalleryItem>) => {
		const items = value.items.map((item, itemIndex) =>
			itemIndex === index ? { ...item, ...patch } : item,
		);
		onChange({ ...value, items });
	};

	const move = (index: number, offset: -1 | 1) => {
		onChange({ ...value, items: moveArrayItem(value.items, index, offset) });
	};

	const removeItem = (index: number) => {
		const items = value.items.filter((_, i) => i !== index);
		onChange({ ...value, items });
	};

	function handleAssetSelect(assetId: string) {
		if (pickerIndex !== null) {
			updateItem(pickerIndex, { image: { type: 'uploaded' as const, assetId } });
			setPickerIndex(null);
		}
	}

	return (
		<div className="invitation-editor__gallery">
			<div className="invitation-editor__field-grid">
				<label className="invitation-editor__field">
					<span>Título de la galería</span>
					<input
						value={value.title ?? ''}
						onChange={(event) => onChange({ ...value, title: event.target.value })}
					/>
				</label>
				<label className="invitation-editor__field">
					<span>Subtítulo</span>
					<input
						value={value.subtitle ?? ''}
						onChange={(event) => onChange({ ...value, subtitle: event.target.value })}
					/>
				</label>
			</div>
			<label className="invitation-editor__field invitation-editor__crop-mode">
				<span>Vista previa</span>
				<select
					value={cropMode}
					onChange={(event) => setCropMode(event.target.value as PreviewDevice)}
				>
					<option value="mobile">Móvil</option>
					<option value="tablet">Tableta</option>
					<option value="desktop">Escritorio</option>
				</select>
			</label>

			<div className="invitation-editor__gallery-grid">
				{value.items.map((item, index) => {
					const src = resolveAssetSrc(item.image, assetLookupSlug, assets);
					const role = getGalleryPreviewRole(index, variant);
					return (
						<article
							className="invitation-editor__gallery-item"
							key={`${index}-${imageItemKey(item.image)}`}
							data-layout-role={role}
						>
							<div className="invitation-editor__gallery-item-header">
								<strong>Fotografía {index + 1}</strong>
								<span>{GALLERY_ROLE_LABELS[role]}</span>
							</div>
							<div className="invitation-editor__gallery-item-config">
								<span className="invitation-editor__gallery-item-key">
									{imageItemKey(item.image)}
								</span>
								{invitationId && (
									<div className="invitation-editor__gallery-item-actions">
										<button
											type="button"
											className="invitation-editor__action-bar-btn invitation-editor__action-bar-btn--secondary"
											onClick={() => setPickerIndex(index)}
										>
											Seleccionar imagen
										</button>
										<button
											type="button"
											className="invitation-editor__link-button invitation-editor__link-button--danger"
											onClick={() => removeItem(index)}
										>
											Quitar de galería
										</button>
									</div>
								)}
							</div>
							<div className="invitation-editor__gallery-crops">
								<div>
									<span>{DEVICE_LABELS[cropMode]}</span>
									<div
										className={`invitation-editor__gallery-image invitation-editor__gallery-image--${cropMode}-${role}`}
										data-aspect-ratio={getGalleryPreviewAspectRatio(
											role,
											cropMode,
										)}
									>
										{src ? (
											<img
												src={src}
												alt={item.caption || `Fotografía ${index + 1}`}
											/>
										) : (
											<span>Vista previa no disponible</span>
										)}
									</div>
								</div>
							</div>
							<label className="invitation-editor__field">
								<span>Pie de foto</span>
								<input
									value={item.caption ?? ''}
									onChange={(event) =>
										updateItem(index, { caption: event.target.value })
									}
								/>
							</label>
							<details className="invitation-editor__gallery-advanced">
								<summary>Ajustes de encuadre</summary>
								<FocalPointControl
									value={item.focalPoint ?? ''}
									onChange={(value) => updateItem(index, { focalPoint: value })}
									mobileValue={item.focalPointMobile ?? ''}
									onMobileChange={(value) =>
										updateItem(index, { focalPointMobile: value })
									}
									tabletValue={item.focalPointTablet ?? ''}
									onTabletChange={(value) =>
										updateItem(index, { focalPointTablet: value })
									}
									desktopValue={item.focalPointDesktop ?? ''}
									onDesktopChange={(value) =>
										updateItem(index, { focalPointDesktop: value })
									}
									mode={perDeviceMap[index] ? 'per-device' : 'shared'}
									onModeChange={(mode) =>
										setPerDeviceMap((prev) => ({
											...prev,
											[index]: mode === 'per-device',
										}))
									}
									imageSrc={src}
									alt={item.caption || `Fotografía ${index + 1}`}
								/>
							</details>
							<div className="invitation-editor__reorder">
								<button
									type="button"
									className="invitation-editor__action-bar-btn invitation-editor__action-bar-btn--secondary"
									onClick={() => move(index, -1)}
									disabled={index === 0}
								>
									Subir
								</button>
								<button
									type="button"
									className="invitation-editor__action-bar-btn invitation-editor__action-bar-btn--secondary"
									onClick={() => move(index, 1)}
									disabled={index === value.items.length - 1}
								>
									Bajar
								</button>
							</div>
						</article>
					);
				})}
			</div>
			<details className="invitation-editor__internal-notes">
				<summary>
					Notas internas
					{photoNotesDirty && <span> Cambios sin guardar</span>}
				</summary>
				<p>Notas operativas de fotografías; no se publican.</p>
				<label className="invitation-editor__check">
					<input
						type="checkbox"
						checked={photoNotes.whatsappSent ?? false}
						onChange={(event) =>
							onPhotoNotesChange({
								...photoNotes,
								whatsappSent: event.target.checked,
							})
						}
					/>
					<span>Material enviado por WhatsApp</span>
				</label>
				{(
					[
						['generalNotes', 'Notas generales'],
						['cropNotes', 'Recortes y puntos focales'],
						['priorityNotes', 'Prioridades'],
					] as const
				).map(([key, label]) => (
					<TextArea
						key={key}
						label={label}
						value={photoNotes[key] ?? ''}
						onChange={(nextValue) =>
							onPhotoNotesChange({ ...photoNotes, [key]: nextValue })
						}
					/>
				))}
				{photoNotesDirty && (
					<button
						type="button"
						className="invitation-editor__section-save"
						onClick={onSavePhotoNotes}
						disabled={savingPhotoNotes}
					>
						{savingPhotoNotes ? 'Guardando...' : 'Guardar notas internas'}
					</button>
				)}
			</details>

			{pickerIndex !== null && invitationId && (
				<AssetPicker
					invitationId={invitationId}
					onSelect={handleAssetSelect}
					onClose={() => setPickerIndex(null)}
				/>
			)}
		</div>
	);
}
