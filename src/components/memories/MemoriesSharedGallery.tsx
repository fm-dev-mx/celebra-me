import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMemoriesVideoMime } from '@/lib/memories/contract/media-policy';
import { buildMemoriesGalleryApiPath } from '@/lib/memories/contract/private-request';
import {
	formatMemoriesDuration,
	formatMemoriesTime,
	groupMemoriesByDay,
} from '@/lib/memories/client/gallery';
import { memoriesGalleryCopy as copy } from '@/lib/memories/copy';
import type { MemoriesGalleryItem } from '@/lib/memories/contract/catalog';

type Props = {
	publicSlug: string;
	token: string;
	timeZone: string;
};

type Page = { items: MemoriesGalleryItem[]; nextPage: number | null };

function Viewer({
	items,
	index,
	mediaUrl,
	timeZone,
	onIndexChange,
	onClose,
}: {
	items: MemoriesGalleryItem[];
	index: number;
	mediaUrl: (
		item: MemoriesGalleryItem,
		options?: { thumb?: boolean; download?: boolean },
	) => string;
	timeZone: string;
	onIndexChange: (index: number) => void;
	onClose: () => void;
}) {
	const item = items[index];
	const headingRef = useRef<HTMLHeadingElement>(null);
	const latest = useRef({ index, count: items.length, onIndexChange, onClose });
	latest.current = { index, count: items.length, onIndexChange, onClose };

	useEffect(() => {
		const trigger =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		headingRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			const current = latest.current;
			if (event.key === 'Escape') current.onClose();
			if (event.key === 'ArrowLeft' && current.index > 0)
				current.onIndexChange(current.index - 1);
			if (event.key === 'ArrowRight' && current.index < current.count - 1)
				current.onIndexChange(current.index + 1);
		};
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			trigger?.focus();
		};
	}, []);

	if (!item) return null;
	const video = isMemoriesVideoMime(item.mimeType);
	return (
		<div className="memories-guest-sheet memories-gallery-viewer" role="presentation">
			<div
				className="memories-guest-sheet__panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="memories-gallery-viewer-title"
			>
				<h2 id="memories-gallery-viewer-title" ref={headingRef} tabIndex={-1}>
					{copy.position(index + 1, items.length)}
				</h2>
				{video ? (
					<video key={item.id} controls preload="metadata" src={mediaUrl(item)} />
				) : (
					<img
						key={item.id}
						src={mediaUrl(item)}
						alt={item.caption || copy.photoBy(item.uploaderName)}
						className="memories-guest-sheet__media"
					/>
				)}
				{item.caption ? (
					<p className="memories-gallery-viewer__caption">{item.caption}</p>
				) : null}
				<p className="status-page__hint">
					{copy.sharedBy(item.uploaderName, formatMemoriesTime(item.createdAt, timeZone))}
				</p>
				<div className="memories-guest-sheet__actions">
					<button
						type="button"
						className="status-page__btn status-page__btn--outline"
						disabled={index === 0}
						onClick={() => onIndexChange(index - 1)}
					>
						{copy.previous}
					</button>
					<button
						type="button"
						className="status-page__btn status-page__btn--outline"
						disabled={index === items.length - 1}
						onClick={() => onIndexChange(index + 1)}
					>
						{copy.next}
					</button>
				</div>
				<a className="status-page__btn" href={mediaUrl(item, { download: true })} download>
					{copy.download}
				</a>
				<button type="button" className="status-page__text-button" onClick={onClose}>
					{copy.close}
				</button>
			</div>
		</div>
	);
}

/** Read-only gallery for anyone with the link: day-grouped thumbnails and a viewer. */
export default function MemoriesSharedGallery({ publicSlug, token, timeZone }: Props) {
	const base = useMemo(() => buildMemoriesGalleryApiPath(publicSlug, token), [publicSlug, token]);
	const [items, setItems] = useState<MemoriesGalleryItem[]>([]);
	const [nextPage, setNextPage] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [viewerIndex, setViewerIndex] = useState<number | null>(null);

	const mediaUrl = useCallback(
		(item: MemoriesGalleryItem, options: { thumb?: boolean; download?: boolean } = {}) => {
			const params = new URLSearchParams();
			if (options.thumb) params.set('variant', 'thumb');
			if (options.download) params.set('download', '1');
			const query = params.toString();
			return `${base}/items/${encodeURIComponent(item.id)}${query ? `?${query}` : ''}`;
		},
		[base],
	);

	const load = useCallback(
		async (page: number) => {
			setLoading(true);
			setError(false);
			try {
				const response = await fetch(`${base}/items?page=${page}`, {
					credentials: 'same-origin',
				});
				if (!response.ok) throw new Error(String(response.status));
				const payload = (await response.json()) as Page;
				setItems((current) =>
					page === 0 ? payload.items : [...current, ...payload.items],
				);
				setNextPage(payload.nextPage);
			} catch {
				setError(true);
			} finally {
				setLoading(false);
			}
		},
		[base],
	);

	useEffect(() => {
		void load(0);
	}, [load]);

	if (error && items.length === 0) {
		return (
			<div className="memories-notice memories-notice--danger" role="alert">
				<p>{copy.loadError}</p>
				<button type="button" className="status-page__btn" onClick={() => void load(0)}>
					{copy.retry}
				</button>
			</div>
		);
	}

	if (!loading && items.length === 0) {
		return <p className="memories-gallery-empty">{copy.empty}</p>;
	}

	return (
		<section className="memories-shared-gallery" aria-label={copy.title} aria-busy={loading}>
			<div className="memories-gallery">
				{groupMemoriesByDay(items, timeZone).map((group) => (
					<section
						key={group.key}
						className="memories-gallery__day"
						aria-label={group.label}
					>
						<h2 className="memories-gallery__day-title">
							{group.label} · {group.items.length.toLocaleString('es-MX')}
						</h2>
						<ul className="memories-gallery__grid memories-guest-memories__grid">
							{group.items.map((item) => {
								const video = isMemoriesVideoMime(item.mimeType);
								const duration = video
									? formatMemoriesDuration(item.durationSeconds)
									: null;
								return (
									<li key={item.id}>
										<button
											type="button"
											className="memories-tile"
											aria-label={`${video ? copy.videoBy(item.uploaderName) : copy.photoBy(item.uploaderName)}${item.caption ? `, ${item.caption}` : ''}`}
											onClick={() =>
												setViewerIndex(
													items.findIndex(
														(entry) => entry.id === item.id,
													),
												)
											}
										>
											{video && !item.hasThumbnail ? (
												<video
													src={mediaUrl(item)}
													preload="metadata"
													muted
													playsInline
													aria-hidden="true"
													tabIndex={-1}
												/>
											) : (
												<img
													src={mediaUrl(item, { thumb: true })}
													alt=""
													loading="lazy"
												/>
											)}
											{video ? (
												<span
													className="memories-tile__badge"
													aria-hidden="true"
												>
													{duration ?? copy.video}
												</span>
											) : null}
										</button>
									</li>
								);
							})}
						</ul>
					</section>
				))}
			</div>
			{nextPage !== null ? (
				<button
					type="button"
					className="status-page__btn status-page__btn--outline"
					disabled={loading}
					onClick={() => void load(nextPage)}
				>
					{loading ? copy.loading : copy.loadMore}
				</button>
			) : null}
			{viewerIndex !== null ? (
				<Viewer
					items={items}
					index={viewerIndex}
					mediaUrl={mediaUrl}
					timeZone={timeZone}
					onIndexChange={setViewerIndex}
					onClose={() => setViewerIndex(null)}
				/>
			) : null}
		</section>
	);
}
