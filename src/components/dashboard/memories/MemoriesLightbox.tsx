import { useEffect, useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import type { MemoriesOrganizerItem } from '@/lib/memories/contract/catalog';
import { MEMORIES_MAX_CAPTION_LENGTH } from '@/lib/memories/contract/limits';
import { isMemoriesVideoMime } from '@/lib/memories/contract/media-policy';
import { formatMemoriesDateTime, formatMemoriesFileSize } from '@/lib/memories/copy';
import { MEMORIES_ORGANIZER_STATUS_LABEL } from '@/components/dashboard/memories/MemoriesGallery';

interface Props {
	items: MemoriesOrganizerItem[];
	index: number;
	timeZone: string;
	previewUrl: (item: MemoriesOrganizerItem) => string;
	downloadUrl: (item: MemoriesOrganizerItem) => string;
	onIndexChange: (index: number) => void;
	onClose: () => void;
	onSaveCaption: (item: MemoriesOrganizerItem, caption: string) => Promise<boolean>;
	onToggleHidden: (item: MemoriesOrganizerItem) => Promise<boolean>;
	onRequestDelete: (item: MemoriesOrganizerItem) => void;
	onRequestBlock: (item: MemoriesOrganizerItem) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	);
}

/** Full-size viewer for one memory with previous/next navigation and its actions. */
export default function MemoriesLightbox({
	items,
	index,
	timeZone,
	previewUrl,
	downloadUrl,
	onIndexChange,
	onClose,
	onSaveCaption,
	onToggleHidden,
	onRequestDelete,
	onRequestBlock,
}: Props) {
	const item = items[index];
	const [editing, setEditing] = useState(false);
	const [caption, setCaption] = useState('');
	const [saving, setSaving] = useState(false);
	const hasPrevious = index > 0;
	const hasNext = index < items.length - 1;

	useEffect(() => {
		setEditing(false);
	}, [item?.id]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (isTypingTarget(event.target)) return;
			if (event.key === 'ArrowLeft' && index > 0) {
				event.preventDefault();
				onIndexChange(index - 1);
			}
			if (event.key === 'ArrowRight' && index < items.length - 1) {
				event.preventDefault();
				onIndexChange(index + 1);
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [index, items.length, onIndexChange]);

	if (!item) return null;
	const accepted = item.status === 'accepted';
	const video = isMemoriesVideoMime(item.mimeType);

	const saveCaption = async () => {
		setSaving(true);
		try {
			if (await onSaveCaption(item, caption)) setEditing(false);
		} finally {
			setSaving(false);
		}
	};

	return (
		<ModalShell
			title={`Recuerdo ${index + 1} de ${items.length}`}
			size="lg"
			className="memories-lightbox"
			onClose={onClose}
			initialFocus="heading"
			footer={
				<div className="memories-lightbox__actions">
					{accepted ? (
						<a className="btn-primary" href={downloadUrl(item)} download>
							Descargar
						</a>
					) : null}
					{accepted ? (
						<button
							type="button"
							className="btn-secondary"
							aria-pressed={item.hidden}
							onClick={() => void onToggleHidden(item)}
						>
							{item.hidden ? 'Mostrar en la galería' : 'Ocultar'}
						</button>
					) : null}
					<button
						type="button"
						className="btn-secondary"
						onClick={() => {
							setCaption(item.caption);
							setEditing(true);
						}}
					>
						Editar descripción
					</button>
					{item.status !== 'deleted' ? (
						<button
							type="button"
							className="btn-secondary"
							onClick={() => onRequestDelete(item)}
						>
							Eliminar
						</button>
					) : null}
					<button
						type="button"
						className="btn-secondary"
						onClick={() => onRequestBlock(item)}
					>
						Bloquear invitado
					</button>
				</div>
			}
		>
			<div className="dashboard-modal__content">
				<div className="memories-lightbox__stage">
					<button
						type="button"
						className="memories-lightbox__nav memories-lightbox__nav--previous"
						aria-label="Anterior"
						disabled={!hasPrevious}
						onClick={() => onIndexChange(index - 1)}
					>
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							aria-hidden="true"
						>
							<path d="m15 6-6 6 6 6" />
						</svg>
					</button>
					<div className="memories-lightbox__media">
						{accepted ? (
							video ? (
								<video
									key={item.id}
									controls
									preload="metadata"
									src={previewUrl(item)}
								/>
							) : (
								<img
									key={item.id}
									src={previewUrl(item)}
									alt={item.caption || `Foto de ${item.uploader.displayName}`}
								/>
							)
						) : (
							<p className="memories-lightbox__placeholder">
								{MEMORIES_ORGANIZER_STATUS_LABEL[item.status]}
							</p>
						)}
					</div>
					<button
						type="button"
						className="memories-lightbox__nav memories-lightbox__nav--next"
						aria-label="Siguiente"
						disabled={!hasNext}
						onClick={() => onIndexChange(index + 1)}
					>
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							aria-hidden="true"
						>
							<path d="m9 6 6 6-6 6" />
						</svg>
					</button>
				</div>

				<div className="memories-lightbox__details">
					{editing ? (
						<div className="memories-lightbox__edit">
							<label htmlFor={`caption-${item.id}`}>Descripción</label>
							<textarea
								id={`caption-${item.id}`}
								value={caption}
								maxLength={MEMORIES_MAX_CAPTION_LENGTH}
								onChange={(event) => setCaption(event.target.value)}
							/>
							<div>
								<button
									type="button"
									className="btn-primary"
									disabled={saving}
									onClick={() => void saveCaption()}
								>
									{saving ? 'Guardando…' : 'Guardar'}
								</button>
								<button
									type="button"
									className="btn-secondary"
									disabled={saving}
									onClick={() => setEditing(false)}
								>
									Cancelar
								</button>
							</div>
						</div>
					) : (
						<p className="memories-lightbox__caption">
							{item.caption || 'Sin descripción'}
						</p>
					)}
					<p className="memories-lightbox__meta">
						{item.uploader.displayName} ·{' '}
						{formatMemoriesDateTime(item.createdAt, timeZone)} ·{' '}
						{formatMemoriesFileSize(item.sizeBytes)}
						{accepted ? '' : ` · ${MEMORIES_ORGANIZER_STATUS_LABEL[item.status]}`}
						{item.hidden ? ' · Oculta: no aparece en la galería compartida' : ''}
					</p>
				</div>
			</div>
		</ModalShell>
	);
}
