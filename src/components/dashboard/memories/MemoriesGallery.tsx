import type { MemoriesMediaStatus, MemoriesOrganizerItem } from '@/lib/memories/contract/catalog';
import { isMemoriesVideoMime } from '@/lib/memories/contract/media-policy';
import {
	formatMemoriesDuration,
	formatMemoriesTime,
	groupMemoriesByDay,
} from '@/lib/memories/client/gallery';

export const MEMORIES_ORGANIZER_STATUS_LABEL: Record<MemoriesMediaStatus, string> = {
	uploading: 'Subiendo',
	validating: 'Procesando',
	accepted: 'Disponible',
	rejected: 'No válida',
	deleted: 'Eliminada',
	duplicate: 'Duplicada',
};

interface Props {
	items: MemoriesOrganizerItem[];
	timeZone: string;
	mediaUrl: (item: MemoriesOrganizerItem) => string;
	selecting: boolean;
	selectedIds: Readonly<Record<string, unknown>>;
	onOpen: (item: MemoriesOrganizerItem) => void;
	onToggle: (item: MemoriesOrganizerItem) => void;
}

export function describeMemoriesItem(item: MemoriesOrganizerItem, timeZone: string): string {
	const kind = isMemoriesVideoMime(item.mimeType) ? 'Video' : 'Foto';
	const parts = [
		`${kind} de ${item.uploader.displayName}`,
		formatMemoriesTime(item.createdAt, timeZone),
	];
	if (item.caption) parts.push(item.caption);
	if (item.status !== 'accepted') parts.push(MEMORIES_ORGANIZER_STATUS_LABEL[item.status]);
	if (item.hidden) parts.push('Oculta');
	return parts.join(', ');
}

function CheckIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3"
			aria-hidden="true"
		>
			<path d="m5 12 5 5 9-10" />
		</svg>
	);
}

/** Square thumbnails grouped by upload day; a tile opens the viewer or toggles selection. */
export default function MemoriesGallery({
	items,
	timeZone,
	mediaUrl,
	selecting,
	selectedIds,
	onOpen,
	onToggle,
}: Props) {
	return (
		<div className="memories-gallery">
			{groupMemoriesByDay(items, timeZone).map((group) => (
				<section
					key={group.key}
					className="memories-gallery__day"
					aria-label={`${group.label}, ${group.items.length} recuerdos`}
				>
					<h3 className="memories-gallery__day-title">
						{group.label} · {group.items.length.toLocaleString('es-MX')}
					</h3>
					<div className="memories-gallery__grid">
						{group.items.map((item) => {
							const accepted = item.status === 'accepted';
							const video = isMemoriesVideoMime(item.mimeType);
							const selected = Boolean(selectedIds[item.id]);
							const duration = video
								? formatMemoriesDuration(item.durationSeconds)
								: null;
							const classes = [
								'memories-tile',
								selected ? 'memories-tile--selected' : '',
								accepted ? '' : 'memories-tile--pending',
								item.hidden ? 'memories-tile--hidden' : '',
							]
								.filter(Boolean)
								.join(' ');
							return (
								<button
									key={item.id}
									type="button"
									className={classes}
									aria-label={describeMemoriesItem(item, timeZone)}
									aria-pressed={selecting ? selected : undefined}
									disabled={selecting && !accepted}
									onClick={() => (selecting ? onToggle(item) : onOpen(item))}
								>
									{accepted ? (
										video && !item.hasThumbnail ? (
											<video
												src={mediaUrl(item)}
												preload="metadata"
												muted
												playsInline
												tabIndex={-1}
												aria-hidden="true"
											/>
										) : (
											<img src={mediaUrl(item)} alt="" loading="lazy" />
										)
									) : (
										<span className="memories-tile__status">
											{MEMORIES_ORGANIZER_STATUS_LABEL[item.status]}
										</span>
									)}
									{item.hidden ? (
										<span className="memories-tile__hidden" aria-hidden="true">
											Oculta
										</span>
									) : null}
									{video ? (
										<span className="memories-tile__badge" aria-hidden="true">
											<svg
												width="9"
												height="9"
												viewBox="0 0 24 24"
												fill="currentColor"
											>
												<path d="M7 4v16l13-8z" />
											</svg>
											{duration ?? 'Video'}
										</span>
									) : null}
									{selecting && accepted ? (
										<span className="memories-tile__check" aria-hidden="true">
											{selected ? <CheckIcon /> : null}
										</span>
									) : null}
								</button>
							);
						})}
					</div>
				</section>
			))}
		</div>
	);
}
