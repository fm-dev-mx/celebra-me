import { useEffect, useRef, useState } from 'react';
import type { MemoriesMediaPublicItem } from '@/lib/memories/contract/catalog';
import {
	MEMORIES_MAX_CAPTION_LENGTH,
	MEMORIES_PRESIGN_TTL_SECONDS,
} from '@/lib/memories/contract/limits';
import {
	isMemoriesVideoMime,
	withMemoriesVideoFirstFrame,
} from '@/lib/memories/contract/media-policy';
import {
	memoriesCaptureCopy as copy,
	memoriesGalleryCopy as galleryCopy,
} from '@/lib/memories/copy';
import MemoriesRecoveryCodeCard from '@/components/memories/MemoriesRecoveryCodeCard';

type Item = MemoriesMediaPublicItem;

type Props = {
	items: Item[];
	mediaUrl: (itemId: string) => string;
	thumbnailUrl: (item: Item) => string;
	onSaveCaption: (item: Item, caption: string) => Promise<boolean>;
	onDelete: (item: Item) => Promise<boolean>;
	/** Resolves the new code, or null when it could not be issued. */
	onRotateRecoveryCode: () => Promise<string | null>;
};

function memoriesGuestStatusLabel(item: Item): string {
	if (item.status === 'accepted') return copy.accepted;
	if (item.status === 'duplicate') return copy.duplicate;
	if (item.status === 'rejected') return copy.rejected;
	if (item.status === 'deleted') return copy.deleted;
	// Past the signed upload's lifetime the bytes can no longer arrive.
	if (
		item.status === 'uploading' &&
		Date.now() - Date.parse(item.createdAt) > MEMORIES_PRESIGN_TTL_SECONDS * 1000
	)
		return copy.uploadUnfinished;
	return copy.validationPending;
}

function MemoryOptions({
	item,
	mediaUrl,
	onClose,
	onSaveCaption,
	onDelete,
}: {
	item: Item;
	mediaUrl: (itemId: string) => string;
	onClose: () => void;
	onSaveCaption: Props['onSaveCaption'];
	onDelete: Props['onDelete'];
}) {
	const [caption, setCaption] = useState(item.caption);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const headingRef = useRef<HTMLHeadingElement>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		const trigger =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		headingRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onCloseRef.current();
		};
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			trigger?.focus();
		};
	}, []);

	const run = async (action: () => Promise<boolean>, failure: string) => {
		setBusy(true);
		setError(null);
		try {
			if (await action()) onClose();
			else setError(failure);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="memories-guest-sheet" role="presentation">
			<div
				className="memories-guest-sheet__panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby={`memory-options-${item.id}`}
			>
				<h3 id={`memory-options-${item.id}`} ref={headingRef} tabIndex={-1}>
					{confirmingDelete ? copy.deleteTitle : copy.memoryOptions}
				</h3>
				{item.status === 'accepted' ? (
					isMemoriesVideoMime(item.mimeType) ? (
						<video
							src={withMemoriesVideoFirstFrame(mediaUrl(item.id))}
							controls
							playsInline
							preload="metadata"
							className="memories-guest-sheet__media"
						/>
					) : (
						<img
							src={mediaUrl(item.id)}
							alt=""
							className="memories-guest-sheet__media"
						/>
					)
				) : null}
				{confirmingDelete ? (
					<>
						<p>{copy.deleteBody}</p>
						<div className="memories-guest-sheet__actions">
							<button
								type="button"
								className="status-page__btn status-page__btn--outline"
								disabled={busy}
								onClick={() => setConfirmingDelete(false)}
							>
								{copy.cancelNameChange}
							</button>
							<button
								type="button"
								className="status-page__btn status-page__btn--danger"
								disabled={busy}
								onClick={() => void run(() => onDelete(item), copy.deleteFailed)}
							>
								{copy.deleteMemory}
							</button>
						</div>
					</>
				) : (
					<>
						<label htmlFor={`memory-caption-${item.id}`}>{copy.editCaption}</label>
						<textarea
							id={`memory-caption-${item.id}`}
							value={caption}
							maxLength={MEMORIES_MAX_CAPTION_LENGTH}
							placeholder={copy.captionPlaceholder}
							onChange={(event) => setCaption(event.target.value)}
						/>
						<div className="memories-guest-sheet__actions">
							<button
								type="button"
								className="status-page__btn"
								disabled={busy}
								onClick={() =>
									void run(() => onSaveCaption(item, caption), copy.captionFailed)
								}
							>
								{copy.saveCaption}
							</button>
							{item.status !== 'deleted' ? (
								<button
									type="button"
									className="status-page__btn status-page__btn--outline"
									disabled={busy}
									onClick={() => setConfirmingDelete(true)}
								>
									{copy.deleteMemory}
								</button>
							) : null}
						</div>
					</>
				)}
				{error ? (
					<p className="status-page__status status-page__status--error" role="alert">
						{error}
					</p>
				) : null}
				<button type="button" className="status-page__text-button" onClick={onClose}>
					{copy.closeOptions}
				</button>
			</div>
		</div>
	);
}

/** The guest's own memories as a grid; a tile opens caption editing and deletion. */
export default function MemoriesGuestMemories({
	items,
	mediaUrl,
	thumbnailUrl,
	onSaveCaption,
	onDelete,
	onRotateRecoveryCode,
}: Props) {
	const [openId, setOpenId] = useState<string | null>(null);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const [codeState, setCodeState] = useState<'idle' | 'busy' | 'failed'>('idle');
	const open = items.find((item) => item.id === openId) ?? null;

	return (
		<section
			id="mis-recuerdos"
			className="memories-guest-memories"
			aria-labelledby="mis-recuerdos-title"
		>
			<h2 id="mis-recuerdos-title">
				{copy.myMemories}
				{items.length > 0 ? <span> {items.length}</span> : null}
			</h2>
			{items.length === 0 ? (
				<p>{copy.noMemories}</p>
			) : (
				<ul className="memories-gallery__grid memories-guest-memories__grid">
					{items.map((item) => {
						const accepted = item.status === 'accepted';
						const video = isMemoriesVideoMime(item.mimeType);
						const label = item.caption || copy.myMemories;
						return (
							<li key={item.id}>
								<button
									type="button"
									className={`memories-tile${accepted ? '' : ' memories-tile--pending'}`}
									aria-label={`${copy.memoryOptions}: ${label}, ${memoriesGuestStatusLabel(item)}`}
									onClick={() => setOpenId(item.id)}
								>
									{accepted ? (
										video && !item.hasThumbnail ? (
											<video
												src={withMemoriesVideoFirstFrame(mediaUrl(item.id))}
												preload="metadata"
												muted
												playsInline
												aria-hidden="true"
												tabIndex={-1}
											/>
										) : (
											<img src={thumbnailUrl(item)} alt={label} />
										)
									) : null}
									{accepted && video ? (
										<span className="memories-tile__badge" aria-hidden="true">
											<span className="memories-tile__play" />
											{galleryCopy.video}
										</span>
									) : null}
									{accepted ? null : (
										<span className="memories-tile__status">
											{memoriesGuestStatusLabel(item)}
										</span>
									)}
								</button>
							</li>
						);
					})}
				</ul>
			)}
			<div className="memories-guest-memories__code">
				{recoveryCode ? (
					<MemoriesRecoveryCodeCard recoveryCode={recoveryCode} />
				) : (
					<button
						type="button"
						className="status-page__btn status-page__btn--outline"
						disabled={codeState === 'busy'}
						onClick={() => {
							if (!window.confirm(copy.showRecoveryCodeConfirm)) return;
							setCodeState('busy');
							void onRotateRecoveryCode().then((code) => {
								setRecoveryCode(code);
								setCodeState(code ? 'idle' : 'failed');
							});
						}}
					>
						{copy.showRecoveryCode}
					</button>
				)}
				{codeState === 'failed' ? (
					<p className="status-page__status status-page__status--error" role="alert">
						{copy.showRecoveryCodeFailed}
					</p>
				) : null}
			</div>
			{open ? (
				<MemoryOptions
					item={open}
					mediaUrl={mediaUrl}
					onClose={() => setOpenId(null)}
					onSaveCaption={onSaveCaption}
					onDelete={onDelete}
				/>
			) : null}
		</section>
	);
}
