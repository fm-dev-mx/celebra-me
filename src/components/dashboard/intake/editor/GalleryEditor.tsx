import {
	getCommonAsset,
	getEventAsset,
	isCommonAssetKey,
	isEventAssetKey,
} from '@/lib/assets/asset-registry';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

type Gallery = NonNullable<DraftContent['gallery']>;
type GalleryItem = Gallery['items'][number];

interface Props {
	value: Gallery;
	previewSlug: string;
	onChange: (value: Gallery) => void;
}

function resolveSrc(source: { src: string | { src: string } }): string {
	return typeof source.src === 'string' ? source.src : source.src.src;
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

export default function GalleryEditor({ value, previewSlug, onChange }: Props) {
	const updateItem = (index: number, patch: Partial<GalleryItem>) => {
		const items = value.items.map((item, itemIndex) =>
			itemIndex === index ? { ...item, ...patch } : item,
		);
		onChange({ ...value, items });
	};

	const move = (index: number, offset: -1 | 1) => {
		const destination = index + offset;
		if (destination < 0 || destination >= value.items.length) return;
		const items = [...value.items];
		[items[index], items[destination]] = [items[destination], items[index]];
		onChange({ ...value, items });
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

			<div className="invitation-editor__gallery-grid">
				{value.items.map((item, index) => {
					const src = getImageSource(item, previewSlug);
					return (
						<article
							className="invitation-editor__gallery-item"
							key={`${index}-${JSON.stringify(item.image)}`}
						>
							<div className="invitation-editor__gallery-image">
								{src ? (
									<img
										src={src}
										alt={item.caption || `Fotografía ${index + 1}`}
									/>
								) : (
									<span>Vista previa no disponible</span>
								)}
								<strong>{index + 1}</strong>
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
							<label className="invitation-editor__field">
								<span>Punto focal</span>
								<input
									placeholder="50% 40%"
									value={item.focalPoint ?? ''}
									onChange={(event) =>
										updateItem(index, { focalPoint: event.target.value })
									}
								/>
							</label>
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
		</div>
	);
}
