import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
	isMemoriesCatalogVisibleStatus,
	isMemoriesTerminalStatus,
	type MemoriesGuestProfile,
	type MemoriesGuestQuota,
	type MemoriesMediaPublicItem,
	type MemoriesMediaStatus,
	type MemoriesSpaceSummary,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_DISPLAY_NAME_MAX_LENGTH,
	MEMORIES_MAX_CAPTION_LENGTH,
} from '@/lib/memories/contract/limits';
import {
	MEMORIES_ALLOWED_MIME_TYPES,
	isMemoriesVideoMime,
	resolveMemoriesFileMimeType,
} from '@/lib/memories/contract/media-policy';
import { memoriesCaptureCopy as copy } from '@/lib/memories/copy';
import {
	MemoriesRequestError,
	createMemoriesGuestApi,
	type MemoriesReservation,
} from '@/lib/memories/client/api';
import {
	calculateFileSha256Hex,
	classifyTransportIssue,
	createSecureClientRequestId,
	mapRequestIssue,
	measureVideoDurationSeconds,
	memoriesIssueCopy,
	optimizeMemoriesImage,
	validateMemoriesFile,
	validateMemoriesVideoDuration,
	type MemoriesCaptureIssue,
} from '@/lib/memories/client/media-prep';
import MemoriesUploadPanel from '@/components/memories/MemoriesUploadPanel';

type CaptureStatus = 'idle' | 'busy' | 'success' | 'error';
type CatalogItem = MemoriesMediaPublicItem;

type MemoriesCaptureProps = {
	space: MemoriesSpaceSummary;
	maxSessionVideos: number;
	readVideoDurationSeconds?: (file: File) => Promise<number>;
	optimizeImage?: (file: File, signal?: AbortSignal) => Promise<File>;
};

const ACCEPT = Object.keys(MEMORIES_ALLOWED_MIME_TYPES).join(',');
const COMPLETION_ATTEMPTS = 3;

class CaptureError extends Error {
	constructor(readonly issue: MemoriesCaptureIssue) {
		super(issue);
		this.name = 'CaptureError';
	}
}

function readCaptureIssue(error: unknown): MemoriesCaptureIssue {
	if (error instanceof CaptureError) return error.issue;
	if (error instanceof MemoriesRequestError) return mapRequestIssue(error, 'sign_failed');
	return classifyTransportIssue('sign_failed');
}

async function putOriginalFile(reservation: MemoriesReservation, file: File): Promise<void> {
	let response: Response;
	try {
		response = await fetch(reservation.upload.uploadUrl, {
			method: 'PUT',
			headers: reservation.upload.requiredHeaders,
			body: file,
		});
	} catch {
		throw new CaptureError(classifyTransportIssue('put_failed'));
	}
	if (!response.ok && response.status !== 412) throw new CaptureError('put_failed');
}

function completionCopy(status: MemoriesMediaStatus): string {
	if (status === 'duplicate') return copy.duplicate;
	if (status === 'rejected') return copy.rejected;
	if (status === 'deleted') return copy.deleted;
	return copy.success;
}

function itemStatusLabel(item: CatalogItem): string {
	if (item.status === 'accepted') return copy.accepted;
	if (item.status === 'duplicate') return copy.duplicate;
	if (item.status === 'rejected') return copy.rejected;
	if (item.status === 'deleted') return copy.deleted;
	return copy.validationPending;
}

function RecoveryCodeCard({ recoveryCode }: { recoveryCode: string | null }) {
	const [copied, setCopied] = useState(false);
	if (!recoveryCode) return null;
	const copyCode = async () => {
		if (!navigator.clipboard) return;
		try {
			await navigator.clipboard.writeText(recoveryCode);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};
	return (
		<aside className="status-page__recovery-code" role="note">
			<strong>{copy.recoveryCodeTitle}</strong>
			<code tabIndex={0}>{recoveryCode}</code>
			<span>{copy.recoveryCodeHint}</span>
			<button type="button" onClick={() => void copyCode()}>
				{copied ? copy.recoveryCodeCopied : copy.copyRecoveryCode}
			</button>
			<small>{copy.recoveryCodeManualHint}</small>
		</aside>
	);
}

export default function MemoriesCapture({
	space,
	maxSessionVideos,
	readVideoDurationSeconds,
	optimizeImage = optimizeMemoriesImage,
}: MemoriesCaptureProps) {
	const inputId = useId();
	const api = useMemo(() => createMemoriesGuestApi(space.publicSlug), [space.publicSlug]);
	const uploadsOpen = space.windowState === 'open';
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedFileRef = useRef<File | null>(null);
	const selectedRequestIdRef = useRef<string | null>(null);
	const preparedFileRef = useRef<File | null>(null);
	const optimizationAbortRef = useRef<AbortController | null>(null);
	const sessionReadyRef = useRef(false);
	const [status, setStatus] = useState<CaptureStatus>('idle');
	const [progressMessage, setProgressMessage] = useState<string>(copy.preparing);
	const [isOptimizing, setIsOptimizing] = useState(false);
	const [completionMessage, setCompletionMessage] = useState<string>(copy.success);
	const [issue, setIssue] = useState<MemoriesCaptureIssue | null>(null);
	const [profile, setProfile] = useState<MemoriesGuestProfile | null>(null);
	const [displayNameDraft, setDisplayNameDraft] = useState('');
	const [editingName, setEditingName] = useState(false);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const [items, setItems] = useState<CatalogItem[]>([]);
	const [quota, setQuota] = useState<MemoriesGuestQuota | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [captionDraft, setCaptionDraft] = useState('');
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
	const [selectedCaption, setSelectedCaption] = useState('');
	const [captionWarning, setCaptionWarning] = useState<string | null>(null);
	const [captionRetry, setCaptionRetry] = useState<{ itemId: string; caption: string } | null>(
		null,
	);
	const message = issue ? memoriesIssueCopy(issue) : null;

	const loadItems = async () => {
		try {
			const payload = await api.listItems();
			sessionReadyRef.current = true;
			setItems(payload.items.filter((item) => isMemoriesCatalogVisibleStatus(item.status)));
			setQuota(payload.quota);
		} catch {
			// A later successful action refreshes the catalog.
		}
	};

	useEffect(() => {
		void (async () => {
			try {
				const existingProfile = await api.getSession();
				if (!existingProfile) return;
				setProfile(existingProfile);
				setDisplayNameDraft(existingProfile.displayName);
				sessionReadyRef.current = true;
				await loadItems();
			} catch {
				setIssue(classifyTransportIssue('unavailable'));
			}
		})();
		return () => optimizationAbortRef.current?.abort();
		// The island mounts once per space.
	}, [api]);

	useEffect(() => {
		if (!selectedFile || typeof URL.createObjectURL !== 'function') {
			setSelectedPreviewUrl(null);
			return;
		}
		const objectUrl = URL.createObjectURL(selectedFile);
		setSelectedPreviewUrl(objectUrl);
		return () => URL.revokeObjectURL(objectUrl);
	}, [selectedFile]);

	const startSession = async () => {
		try {
			const created = await api.createSession(displayNameDraft);
			setProfile(created.profile);
			setDisplayNameDraft(created.profile.displayName);
			sessionReadyRef.current = true;
			setIssue(null);
			if (created.recoveryCode) setRecoveryCode(created.recoveryCode);
			await loadItems();
		} catch (error) {
			setIssue(mapRequestIssue(error, 'unavailable'));
		}
	};

	const saveProfile = async () => {
		try {
			const nextProfile = await api.updateProfile(displayNameDraft);
			setProfile(nextProfile);
			setDisplayNameDraft(nextProfile.displayName);
			setEditingName(false);
		} catch (error) {
			setIssue(mapRequestIssue(error, 'unavailable'));
		}
	};

	const resetInput = () => {
		if (inputRef.current) inputRef.current.value = '';
	};

	const saveCaptionQuietly = async (itemId: string, caption: string): Promise<boolean> => {
		const normalized = caption.trim();
		if (!normalized) return true;
		try {
			await api.updateCaption(itemId, normalized);
			return true;
		} catch {
			return false;
		}
	};

	const completeReservedUpload = async (itemId: string): Promise<MemoriesMediaStatus> => {
		for (let attempt = 0; attempt < COMPLETION_ATTEMPTS; attempt += 1) {
			try {
				const payload = await api.complete(itemId);
				if (isMemoriesTerminalStatus(payload.item.status)) return payload.item.status;
			} catch {
				// A bounded idempotent retry handles transient completion failures.
			}
			if (attempt < COMPLETION_ATTEMPTS - 1)
				await new Promise((resolve) => setTimeout(resolve, 300 * 3 ** attempt));
		}
		throw new CaptureError(classifyTransportIssue('put_failed'));
	};

	const uploadSelectedFile = async (file: File) => {
		if (!uploadsOpen) {
			setStatus('error');
			setIssue('window_closed');
			return;
		}
		if (!sessionReadyRef.current || !profile) {
			setStatus('error');
			setIssue(classifyTransportIssue('unavailable'));
			return;
		}
		const mimeType = resolveMemoriesFileMimeType(file);
		if (!mimeType) {
			setStatus('error');
			setIssue('unsupported_type');
			return;
		}
		setStatus('busy');
		setProgressMessage(copy.preparing);
		setIssue(null);
		let uploadFile = preparedFileRef.current;
		if (!uploadFile) {
			const controller = new AbortController();
			optimizationAbortRef.current?.abort();
			optimizationAbortRef.current = controller;
			if (!isMemoriesVideoMime(mimeType)) {
				setProgressMessage(copy.optimizing);
				setIsOptimizing(true);
			}
			try {
				uploadFile = await optimizeImage(file, controller.signal);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				setStatus('error');
				setIssue('unavailable');
				return;
			} finally {
				setIsOptimizing(false);
				if (optimizationAbortRef.current === controller)
					optimizationAbortRef.current = null;
			}
			preparedFileRef.current = uploadFile;
		}
		const fileIssue = validateMemoriesFile(uploadFile);
		if (fileIssue) {
			setStatus('error');
			setIssue(fileIssue);
			return;
		}
		let durationSeconds: number | undefined;
		const durationIssue = await validateMemoriesVideoDuration(uploadFile, async (candidate) => {
			durationSeconds = await (readVideoDurationSeconds ?? measureVideoDurationSeconds)(
				candidate,
			);
			return durationSeconds;
		});
		if (durationIssue) {
			setStatus('error');
			setIssue(durationIssue);
			return;
		}
		try {
			const checksumSha256 = await calculateFileSha256Hex(uploadFile);
			const clientRequestId = selectedRequestIdRef.current ?? createSecureClientRequestId();
			selectedRequestIdRef.current = clientRequestId;
			const reservation = await api.reserve({
				mimeType,
				sizeBytes: uploadFile.size,
				checksumSha256,
				durationSeconds,
				clientRequestId,
			});
			setProgressMessage(copy.uploading);
			await putOriginalFile(reservation, uploadFile);
			setProgressMessage(copy.confirming);
			const completedStatus = await completeReservedUpload(reservation.item.id);
			setCompletionMessage(completionCopy(completedStatus));
			const captionToSave = selectedCaption.trim();
			const captionSaved = await saveCaptionQuietly(reservation.item.id, captionToSave);
			setCaptionWarning(captionSaved ? null : copy.captionSaveFailed);
			setCaptionRetry(
				captionSaved || !captionToSave
					? null
					: { itemId: reservation.item.id, caption: captionToSave },
			);
			await loadItems();
			selectedFileRef.current = null;
			preparedFileRef.current = null;
			selectedRequestIdRef.current = null;
			resetInput();
			setSelectedFile(null);
			setSelectedCaption('');
			setStatus('success');
			setIssue(null);
		} catch (error) {
			setStatus('error');
			setIssue(readCaptureIssue(error));
		}
	};

	const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!resolveMemoriesFileMimeType(file)) {
			setSelectedFile(null);
			setStatus('error');
			setIssue('unsupported_type');
			resetInput();
			return;
		}
		selectedFileRef.current = file;
		preparedFileRef.current = null;
		selectedRequestIdRef.current = createSecureClientRequestId();
		setSelectedFile(file);
		setSelectedCaption('');
		setCaptionWarning(null);
		setStatus('idle');
		setIssue(null);
	};
	const onConfirmUpload = () => {
		const file = selectedFileRef.current;
		if (file) void uploadSelectedFile(file);
	};
	const onRetry = () => {
		const file = selectedFileRef.current;
		if (!file) {
			resetInput();
			setStatus('idle');
			setIssue(null);
			return;
		}
		void uploadSelectedFile(file);
	};
	const clearSelection = () => {
		optimizationAbortRef.current?.abort();
		optimizationAbortRef.current = null;
		selectedFileRef.current = null;
		preparedFileRef.current = null;
		selectedRequestIdRef.current = null;
		setIsOptimizing(false);
		resetInput();
		setSelectedFile(null);
		setSelectedCaption('');
		setCaptionWarning(null);
		setStatus('idle');
		setIssue(null);
	};
	const onCancelOptimization = () => {
		optimizationAbortRef.current?.abort();
		optimizationAbortRef.current = null;
		preparedFileRef.current = null;
		setIsOptimizing(false);
		setStatus('idle');
		setIssue(null);
	};
	const onUploadAnother = () => {
		clearSelection();
		setCaptionRetry(null);
		setProgressMessage(copy.preparing);
	};

	const retryUploadedCaption = async () => {
		if (!captionRetry) return;
		const saved = await saveCaptionQuietly(captionRetry.itemId, captionRetry.caption);
		if (!saved) return;
		setCaptionWarning(null);
		setCaptionRetry(null);
		await loadItems();
	};

	const saveCaption = async (item: CatalogItem) => {
		try {
			await api.updateCaption(item.id, captionDraft);
			setEditingId(null);
			await loadItems();
		} catch {
			// The editor stays open so the guest can retry.
		}
	};
	const deleteItem = async (item: CatalogItem) => {
		if (!window.confirm(copy.confirmDelete)) return;
		try {
			await api.deleteItem(item.id);
			await loadItems();
		} catch {
			// The catalog keeps the item until a later refresh confirms deletion.
		}
	};

	return (
		<div className="status-page__capture" data-capture="memories">
			{profile ? (
				<section className="status-page__identity" aria-label={copy.profileSectionLabel}>
					{editingName ? (
						<>
							<label htmlFor={`${inputId}-display-name`}>
								{copy.displayNameLabel}
							</label>
							<div className="status-page__inline-controls">
								<input
									id={`${inputId}-display-name`}
									value={displayNameDraft}
									maxLength={MEMORIES_DISPLAY_NAME_MAX_LENGTH}
									onChange={(event) => setDisplayNameDraft(event.target.value)}
								/>
								<button
									type="button"
									disabled={!displayNameDraft.trim()}
									onClick={() => void saveProfile()}
								>
									{copy.saveLabel}
								</button>
								<button type="button" onClick={() => setEditingName(false)}>
									{copy.cancelNameChange}
								</button>
							</div>
						</>
					) : (
						<p>
							{copy.sharingAs} <strong>{profile.displayName}</strong>{' '}
							<button
								type="button"
								className="status-page__text-button"
								onClick={() => setEditingName(true)}
							>
								{copy.changeName}
							</button>
						</p>
					)}
				</section>
			) : (
				<section
					className="status-page__onboarding"
					aria-label={copy.onboardingSectionLabel}
				>
					<label htmlFor={`${inputId}-new-display-name`}>{copy.displayNameLabel}</label>
					<input
						id={`${inputId}-new-display-name`}
						value={displayNameDraft}
						maxLength={MEMORIES_DISPLAY_NAME_MAX_LENGTH}
						autoComplete="nickname"
						onChange={(event) => setDisplayNameDraft(event.target.value)}
					/>
					<button
						type="button"
						className="status-page__btn"
						disabled={!displayNameDraft.trim()}
						onClick={() => void startSession()}
					>
						{copy.continueLabel}
					</button>
				</section>
			)}

			{profile && uploadsOpen && status !== 'success' ? (
				<MemoriesUploadPanel
					inputId={inputId}
					inputRef={inputRef}
					accept={ACCEPT}
					maxSessionVideos={maxSessionVideos}
					selectedFile={selectedFile}
					selectedPreviewUrl={selectedPreviewUrl}
					selectedCaption={selectedCaption}
					status={status}
					quota={quota}
					onFileChange={onFileChange}
					onCaptionChange={setSelectedCaption}
					onConfirmUpload={onConfirmUpload}
					onCancelSelection={clearSelection}
				/>
			) : status === 'success' ? (
				<section className="status-page__success" aria-live="polite">
					<p className="status-page__status" role="status">
						{completionMessage}
					</p>
					{captionWarning ? (
						<div className="status-page__caption-warning">
							<p
								className="status-page__status status-page__status--warning"
								role="status"
							>
								{captionWarning}
							</p>
							{captionRetry ? (
								<button
									type="button"
									className="status-page__btn status-page__btn--outline"
									onClick={() => void retryUploadedCaption()}
								>
									{copy.retryCaption}
								</button>
							) : null}
						</div>
					) : null}
					<div className="status-page__inline-actions">
						<button
							type="button"
							className="status-page__btn"
							onClick={onUploadAnother}
						>
							{copy.uploadAnother}
						</button>
						<a
							href="#mis-recuerdos"
							className="status-page__btn status-page__btn--outline"
						>
							{copy.viewMemories}
						</a>
					</div>
				</section>
			) : null}

			{status === 'error' && message ? (
				<section className="status-page__upload-error">
					<p className="status-page__status status-page__status--error" role="alert">
						{message}
					</p>
					{uploadsOpen ? (
						<button
							type="button"
							className="status-page__btn status-page__btn--outline"
							onClick={onRetry}
						>
							{copy.retry}
						</button>
					) : null}
				</section>
			) : null}

			{status === 'busy' ? (
				<section className="status-page__progress">
					<p className="status-page__status" role="status" aria-live="polite">
						{progressMessage}
					</p>
					{isOptimizing ? (
						<button
							type="button"
							className="status-page__btn status-page__btn--outline"
							onClick={onCancelOptimization}
						>
							{copy.cancelOptimization}
						</button>
					) : null}
				</section>
			) : null}

			<RecoveryCodeCard recoveryCode={recoveryCode} />

			{profile ? (
				<section
					id="mis-recuerdos"
					className="status-page__memories"
					aria-label={copy.myMemories}
				>
					<h2>{copy.myMemories}</h2>
					{items.length === 0 ? (
						<p>{copy.noMemories}</p>
					) : (
						items.map((item) => (
							<article key={item.id} className="status-page__memory-card">
								{item.status === 'accepted' ? (
									isMemoriesVideoMime(item.mimeType) ? (
										<video
											controls
											preload="metadata"
											src={api.itemMediaUrl(item.id)}
										/>
									) : (
										<img
											loading="lazy"
											src={api.itemMediaUrl(item.id)}
											alt={item.caption || copy.myMemories}
										/>
									)
								) : null}
								<p>{itemStatusLabel(item)}</p>
								{editingId === item.id ? (
									<div className="status-page__inline-controls">
										<input
											value={captionDraft}
											maxLength={MEMORIES_MAX_CAPTION_LENGTH}
											onChange={(event) =>
												setCaptionDraft(event.target.value)
											}
											aria-label={copy.editCaption}
										/>
										<button
											type="button"
											onClick={() => void saveCaption(item)}
										>
											{copy.saveCaption}
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={() => {
											setEditingId(item.id);
											setCaptionDraft(item.caption);
										}}
									>
										{copy.editCaption}
									</button>
								)}
								{item.status !== 'deleted' ? (
									<button type="button" onClick={() => void deleteItem(item)}>
										{copy.deleteMemory}
									</button>
								) : null}
							</article>
						))
					)}
				</section>
			) : null}
		</div>
	);
}
