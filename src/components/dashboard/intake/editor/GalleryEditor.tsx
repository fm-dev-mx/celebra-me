import {
	getCommonAsset,
	getEventAsset,
	isCommonAssetKey,
	isEventAssetKey,
} from '@/lib/assets/asset-registry';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import FocalPointControl from '@/components/dashboard/intake/editor/FocalPointControl';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import {
	GALLERY_ROLE_LABELS,
	getGalleryPreviewAspectRatio,
	getGalleryPreviewRole,
} from '@/lib/components/gallery/gallery-presentation';
import { moveArrayItem } from '@/lib/intake/utils';
import { useState } from 'react';

type Gallery = NonNullable<DraftContent['gallery']>;
type GalleryItem = Gallery['items'][number];

interface Props {
	value: Gallery;
	previewSlug: string;
	onChange: (value: Gallery) => void;
	variant?: string;
	photoNotes?: NonNullable<DraftContent['photoNotes']>;
	onPhotoNotesChange?: (value: NonNullable<DraftContent['photoNotes']>) => void;
	onSavePhotoNotes?: () => void;
	photoNotesDirty?: boolean;
	savingPhotoNotes?: boolean;
}

function resolveSrc(source: { src: string | { src: string } }): string {
	return typeof source.src === 'string' ? source.src : source.src.src;
}

function imageItemKey(image: GalleryItem['image']): string {
	if (typeof image === 'string') return image;
	if (image.type === 'internal') return image.key;
	return image.src;
}

function getImageSource(item: GalleryItem, previewSlug: string): string | undefined {
	const image = item.image;
	if (typeof image === 'string') {
		if (image.startsWith('/') || image.startsWith('https://')) return image;
		if (isEventAssetKey(image)) return getEventAsset(previewSlug, image)?.src;
		if (isCommonAssetKey(image)) return resolveSrc(getCommonAsset(image));
		return undefined;
	}
	if (image.type === 'external') return image.src;
	if (isEventAssetKey(image.key)) return getEventAsset(previewSlug, image.key)?.src;
	return resolveSrc(getCommonAsset(image.key));
}

export default function GalleryEditor({
	value,
	previewSlug,
	onChange,
	variant,
	photoNotes = {},
	onPhotoNotesChange = () => undefined,
	onSavePhotoNotes = () => undefined,
	photoNotesDirty = false,
	savingPhotoNotes = false,
}: Props) {
	const [cropMode, setCropMode] = useState<'mobile' | 'desktop'>('mobile');
	const updateItem = (index: number, patch: Partial<GalleryItem>) => {
		const items = value.items.map((item, itemIndex) =>
			itemIndex === index ? { ...item, ...patch } : item,
		);
		onChange({ ...value, items });
	};

	const move = (index: number, offset: -1 | 1) => {
		onChange({ ...value, items: moveArrayItem(value.items, index, offset) });
	};

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
				<span>Modo de recorte</span>
				<select
					value={cropMode}
					onChange={(event) => setCropMode(event.target.value as 'mobile' | 'desktop')}
				>
					<option value="mobile">Móvil</option>
					<option value="desktop">Escritorio</option>
				</select>
			</label>

			<div className="invitation-editor__gallery-grid">
				{value.items.map((item, index) => {
					const src = getImageSource(item, previewSlug);
					const role = getGalleryPreviewRole(index, variant);
					const focalPoint = item.focalPoint || 'center';
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
							<div className="invitation-editor__gallery-crops">
								{(['mobile', 'desktop'] as const).map((viewport) => (
									<div
										key={viewport}
										className={
											cropMode === viewport
												? 'invitation-editor__gallery-crop--active'
												: undefined
										}
									>
										<span>
											{viewport === 'mobile' ? 'Móvil' : 'Escritorio'}
										</span>
										<div
											className={`invitation-editor__gallery-image invitation-editor__gallery-image--${viewport}-${role}`}
											data-aspect-ratio={getGalleryPreviewAspectRatio(
												role,
												viewport,
											)}
										>
											{src ? (
												<img
													src={src}
													alt={item.caption || `Fotografía ${index + 1}`}
													// eslint-disable-next-line no-restricted-syntax -- live crop preview from focal point input
													style={{ objectPosition: focalPoint }}
												/>
											) : (
												<span>Vista previa no disponible</span>
											)}
										</div>
									</div>
								))}
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
							<FocalPointControl
								value={item.focalPoint ?? ''}
								onChange={(value) => updateItem(index, { focalPoint: value })}
								imageSrc={src}
								alt={item.caption || `Fotografía ${index + 1}`}
							/>
							<div className="invitation-editor__reorder">
								<button
									type="button"
									onClick={() => move(index, -1)}
									disabled={index === 0}
								>
									Subir
								</button>
								<button
									type="button"
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
		</div>
	);
}
