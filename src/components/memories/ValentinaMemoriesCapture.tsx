import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';
import {
	VALENTINA_MEMORIES_DISPLAY_NAME_MAX_LENGTH,
	VALENTINA_MEMORIES_MAX_CAPTION_LENGTH,
	type ValentinaMemoriesGuestProfile,
	type ValentinaMemoriesGuestQuota,
} from '@/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_ALLOWED_MIME_TYPES,
	isAllowedValentinaMemoriesOrigin,
	resolveValentinaMemoriesFileMimeType,
} from '@/data/valentina-memories-upload.contract';
import {
	calculateFileSha256Hex,
	classifyValentinaMemoriesTransportIssue,
	createSecureClientRequestId,
	mapValentinaMemoriesSignError,
	measureVideoDurationSeconds,
	optimizeValentinaMemoriesImage,
	readValentinaMemoriesSignErrorCode,
	validateValentinaMemoriesFile,
	validateValentinaMemoriesVideoDuration,
	valentinaMemoriesIssueCopy,
	type ValentinaMemoriesCaptureIssue,
} from '@/lib/memories/valentina-memories-client';
import {
	createValentinaMemoriesSession,
	getValentinaMemoriesSession,
	updateValentinaMemoriesSession,
} from '@/lib/memories/valentina-memories-session-client';
import ValentinaMemoriesUploadPanel from '@/components/memories/ValentinaMemoriesUploadPanel';

type CaptureStatus = 'idle' | 'busy' | 'success' | 'error';
type CatalogItem = {
	id: string;
	mimeType: string;
	sizeBytes: number;
	durationSeconds: number | null;
	caption: string;
	status: 'uploading' | 'validating' | 'accepted' | 'rejected' | 'deleted' | 'duplicate';
	createdAt: string;
};
type CompletedCatalogStatus = Extract<
	CatalogItem['status'],
	'accepted' | 'duplicate' | 'rejected' | 'deleted'
>;

type ValentinaMemoriesCaptureProps = {
	readVideoDurationSeconds?: (file: File) => Promise<number>;
	optimizeImage?: (file: File, signal?: AbortSignal) => Promise<File>;
	isUploadOriginAllowed?: () => boolean;
};

const ACCEPT = Object.keys(VALENTINA_MEMORIES_ALLOWED_MIME_TYPES).join(',');
const ITEMS_ENDPOINT = '/api/memories/valentina/items';

function currentOriginIsAllowed(): boolean {
	return (
		typeof window === 'undefined' || isAllowedValentinaMemoriesOrigin(window.location.origin)
	);
}

function readCaptureIssue(error: unknown): ValentinaMemoriesCaptureIssue {
	if (error instanceof Error && 'issue' in error) {
		return (error as { issue?: ValentinaMemoriesCaptureIssue }).issue ?? 'sign_failed';
	}
	return classifyValentinaMemoriesTransportIssue('sign_failed');
}

async function reserveUpload(
	file: File,
	checksumSha256: string,
	durationSeconds: number | undefined,
	clientRequestId: string,
): Promise<{
	item: CatalogItem;
	upload: { uploadUrl: string; requiredHeaders: Record<string, string> };
}> {
	const mimeType = resolveValentinaMemoriesFileMimeType(file);
	if (!mimeType)
		throw Object.assign(new Error('unsupported_type'), { issue: 'unsupported_type' as const });
	let response: Response;
	try {
		response = await fetch(ITEMS_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'reserve',
				mimeType,
				sizeBytes: file.size,
				checksumSha256,
				durationSeconds,
				clientRequestId,
			}),
		});
	} catch {
		throw Object.assign(new Error('sign_failed'), {
			issue: classifyValentinaMemoriesTransportIssue('sign_failed'),
		});
	}
	const payload = await response.json().catch(() => null);
	if (!response.ok) {
		throw Object.assign(new Error('sign_failed'), {
			issue: mapValentinaMemoriesSignError(
				response.status,
				readValentinaMemoriesSignErrorCode(payload),
			),
		});
	}
	const parsed = payload as {
		item?: CatalogItem;
		upload?: { uploadUrl?: unknown; requiredHeaders?: unknown };
	};
	if (
		!parsed.item?.id ||
		typeof parsed.upload?.uploadUrl !== 'string' ||
		typeof parsed.upload.requiredHeaders !== 'object' ||
		parsed.upload.requiredHeaders === null
	) {
		throw Object.assign(new Error('sign_failed'), { issue: 'sign_failed' as const });
	}
	return {
		item: parsed.item,
		upload: {
			uploadUrl: parsed.upload.uploadUrl,
			requiredHeaders: parsed.upload.requiredHeaders as Record<string, string>,
		},
	};
}

async function putOriginalFile(
	uploadUrl: string,
	requiredHeaders: Record<string, string>,
	file: File,
): Promise<void> {
	let response: Response;
	try {
		response = await fetch(uploadUrl, {
			method: 'PUT',
			headers: requiredHeaders,
			body: file,
		});
	} catch {
		throw Object.assign(new Error('put_failed'), {
			issue: classifyValentinaMemoriesTransportIssue('put_failed'),
		});
	}
	if (!response.ok && response.status !== 412)
		throw Object.assign(new Error('put_failed'), { issue: 'put_failed' as const });
}

function isCompletedCatalogStatus(
	status: CatalogItem['status'] | undefined,
): status is CompletedCatalogStatus {
	return (
		status === 'accepted' ||
		status === 'duplicate' ||
		status === 'rejected' ||
		status === 'deleted'
	);
}

async function completeReservedUpload(itemId: string): Promise<CompletedCatalogStatus> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			const response = await fetch(`${ITEMS_ENDPOINT}/${encodeURIComponent(itemId)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'complete' }),
			});
			if (response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					item?: { status?: CatalogItem['status'] };
				} | null;
				if (isCompletedCatalogStatus(payload?.item?.status)) return payload.item.status;
			}
		} catch {
			// A bounded idempotent retry handles transient completion failures.
		}
		if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * 3 ** attempt));
	}
	throw Object.assign(new Error('complete_failed'), {
		issue: classifyValentinaMemoriesTransportIssue('put_failed'),
	});
}

function completionCopy(status: CompletedCatalogStatus): string {
	const copy = valentinaMemoriesCaptureCopy;
	if (status === 'duplicate') return copy.duplicate;
	if (status === 'rejected') return copy.rejected;
	if (status === 'deleted') return copy.deleted;
	return copy.success;
}

function itemStatusLabel(item: CatalogItem): string {
	const copy = valentinaMemoriesCaptureCopy;
	if (item.status === 'accepted') return copy.accepted;
	if (item.status === 'duplicate') return copy.duplicate;
	if (item.status === 'rejected') return copy.rejected;
	if (item.status === 'deleted') return copy.deleted;
	return copy.validationPending;
}

function RecoveryCodeCard({ recoveryCode }: { recoveryCode: string | null }) {
	const [copied, setCopied] = useState(false);
	const copy = valentinaMemoriesCaptureCopy;
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

export default function ValentinaMemoriesCapture({
	readVideoDurationSeconds,
	optimizeImage = optimizeValentinaMemoriesImage,
	isUploadOriginAllowed = currentOriginIsAllowed,
}: ValentinaMemoriesCaptureProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedFileRef = useRef<File | null>(null);
	const selectedRequestIdRef = useRef<string | null>(null);
	const preparedFileRef = useRef<File | null>(null);
	const optimizationAbortRef = useRef<AbortController | null>(null);
	const sessionReadyRef = useRef(false);
	const copy = valentinaMemoriesCaptureCopy;
	const [status, setStatus] = useState<CaptureStatus>('idle');
	const [progressMessage, setProgressMessage] = useState<string>(copy.preparing);
	const [isOptimizing, setIsOptimizing] = useState(false);
	const [completionMessage, setCompletionMessage] = useState<string>(copy.success);
	const [issue, setIssue] = useState<ValentinaMemoriesCaptureIssue | null>(null);
	const [profile, setProfile] = useState<ValentinaMemoriesGuestProfile | null>(null);
	const [displayNameDraft, setDisplayNameDraft] = useState('');
	const [editingName, setEditingName] = useState(false);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const [items, setItems] = useState<CatalogItem[]>([]);
	const [quota, setQuota] = useState<ValentinaMemoriesGuestQuota | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [captionDraft, setCaptionDraft] = useState('');
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
	const [selectedCaption, setSelectedCaption] = useState('');
	const [captionWarning, setCaptionWarning] = useState<string | null>(null);
	const [captionRetry, setCaptionRetry] = useState<{ itemId: string; caption: string } | null>(
		null,
	);
	const [originAllowed] = useState(isUploadOriginAllowed);
	const message = issue ? valentinaMemoriesIssueCopy(issue) : null;

	const loadItems = async () => {
		try {
			const response = await fetch(ITEMS_ENDPOINT, {
				headers: { Accept: 'application/json' },
			});
			if (!response.ok) return;
			sessionReadyRef.current = true;
			const payload = (await response.json()) as {
				items?: CatalogItem[];
				quota?: ValentinaMemoriesGuestQuota;
			};
			if (Array.isArray(payload.items)) setItems(payload.items);
			if (payload.quota) setQuota(payload.quota);
		} catch {
			// A later successful action refreshes the catalog.
		}
	};

	useEffect(() => {
		void (async () => {
			try {
				const { profile: existingProfile } = await getValentinaMemoriesSession();
				if (!existingProfile) return;
				setProfile(existingProfile);
				setDisplayNameDraft(existingProfile.displayName);
				sessionReadyRef.current = true;
				await loadItems();
			} catch {
				setIssue(classifyValentinaMemoriesTransportIssue('unavailable'));
			}
		})();
		return () => optimizationAbortRef.current?.abort();
	}, []);

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
			const created = await createValentinaMemoriesSession(displayNameDraft);
			setProfile(created.profile);
			setDisplayNameDraft(created.profile.displayName);
			sessionReadyRef.current = true;
			setIssue(null);
			if (created.recoveryCode) setRecoveryCode(created.recoveryCode);
			await loadItems();
		} catch {
			setIssue(classifyValentinaMemoriesTransportIssue('unavailable'));
		}
	};

	const saveProfile = async () => {
		try {
			const nextProfile = await updateValentinaMemoriesSession(displayNameDraft);
			setProfile(nextProfile);
			setDisplayNameDraft(nextProfile.displayName);
			setEditingName(false);
		} catch {
			setIssue(classifyValentinaMemoriesTransportIssue('unavailable'));
		}
	};

	const resetInput = () => {
		if (inputRef.current) inputRef.current.value = '';
	};

	const saveUploadedCaption = async (
		itemId: string,
		caption = selectedCaption,
	): Promise<boolean> => {
		const normalizedCaption = caption.trim();
		if (!normalizedCaption) return true;
		try {
			const response = await fetch(`${ITEMS_ENDPOINT}/${encodeURIComponent(itemId)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ caption: normalizedCaption }),
			});
			return response.ok;
		} catch {
			return false;
		}
	};

	const uploadSelectedFile = async (file: File) => {
		if (!originAllowed) {
			setStatus('error');
			setIssue('official_origin_required');
			return;
		}
		if (!sessionReadyRef.current || !profile) {
			setStatus('error');
			setIssue(classifyValentinaMemoriesTransportIssue('unavailable'));
			return;
		}
		const mimeType = resolveValentinaMemoriesFileMimeType(file);
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
			if (mimeType.startsWith('image/')) {
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
		const fileIssue = validateValentinaMemoriesFile(uploadFile);
		if (fileIssue) {
			setStatus('error');
			setIssue(fileIssue);
			return;
		}
		let durationSeconds: number | undefined;
		const durationIssue = await validateValentinaMemoriesVideoDuration(
			uploadFile,
			async (candidate) => {
				durationSeconds = await (readVideoDurationSeconds ?? measureVideoDurationSeconds)(
					candidate,
				);
				return durationSeconds;
			},
		);
		if (durationIssue) {
			setStatus('error');
			setIssue(durationIssue);
			return;
		}
		try {
			const checksumSha256 = await calculateFileSha256Hex(uploadFile);
			const clientRequestId = selectedRequestIdRef.current ?? createSecureClientRequestId();
			selectedRequestIdRef.current = clientRequestId;
			const reservation = await reserveUpload(
				uploadFile,
				checksumSha256,
				durationSeconds,
				clientRequestId,
			);
			setProgressMessage(copy.uploading);
			await putOriginalFile(
				reservation.upload.uploadUrl,
				reservation.upload.requiredHeaders,
				uploadFile,
			);
			setProgressMessage(copy.confirming);
			const completedStatus = await completeReservedUpload(reservation.item.id);
			setCompletionMessage(completionCopy(completedStatus));
			const captionToSave = selectedCaption.trim();
			const captionSaved = await saveUploadedCaption(reservation.item.id, captionToSave);
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
		if (!resolveValentinaMemoriesFileMimeType(file)) {
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
	const onCancelOptimization = () => {
		optimizationAbortRef.current?.abort();
		optimizationAbortRef.current = null;
		preparedFileRef.current = null;
		setIsOptimizing(false);
		setStatus('idle');
		setIssue(null);
	};
	const onCancelSelection = () => {
		optimizationAbortRef.current?.abort();
		optimizationAbortRef.current = null;
		selectedFileRef.current = null;
		preparedFileRef.current = null;
		selectedRequestIdRef.current = null;
		setSelectedFile(null);
		setSelectedCaption('');
		setCaptionWarning(null);
		resetInput();
		setStatus('idle');
		setIssue(null);
	};
	const onUploadAnother = () => {
		selectedFileRef.current = null;
		preparedFileRef.current = null;
		optimizationAbortRef.current?.abort();
		selectedRequestIdRef.current = null;
		resetInput();
		setSelectedFile(null);
		setSelectedCaption('');
		setCaptionWarning(null);
		setCaptionRetry(null);
		setStatus('idle');
		setProgressMessage(copy.preparing);
		setIssue(null);
	};

	const retryUploadedCaption = async () => {
		if (!captionRetry) return;
		const saved = await saveUploadedCaption(captionRetry.itemId, captionRetry.caption);
		if (!saved) return;
		setCaptionWarning(null);
		setCaptionRetry(null);
		await loadItems();
	};

	const saveCaption = async (item: CatalogItem) => {
		const response = await fetch(`${ITEMS_ENDPOINT}/${encodeURIComponent(item.id)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ caption: captionDraft }),
		});
		if (response.ok) {
			setEditingId(null);
			await loadItems();
		}
	};
	const deleteItem = async (item: CatalogItem) => {
		if (!window.confirm(copy.confirmDelete)) return;
		const response = await fetch(`${ITEMS_ENDPOINT}/${encodeURIComponent(item.id)}`, {
			method: 'DELETE',
		});
		if (response.ok) await loadItems();
	};

	return (
		<div className="status-page__capture" data-capture="valentina-memories">
			{profile ? (
				<section className="status-page__identity" aria-label="Su perfil de recuerdos">
					{editingName ? (
						<>
							<label htmlFor={`${inputId}-display-name`}>Su nombre o apodo</label>
							<div className="status-page__inline-controls">
								<input
									id={`${inputId}-display-name`}
									value={displayNameDraft}
									maxLength={VALENTINA_MEMORIES_DISPLAY_NAME_MAX_LENGTH}
									onChange={(event) => setDisplayNameDraft(event.target.value)}
								/>
								<button
									type="button"
									disabled={!displayNameDraft.trim()}
									onClick={() => void saveProfile()}
								>
									Guardar
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
					aria-label="Iniciar sesión de recuerdos"
				>
					<label htmlFor={`${inputId}-new-display-name`}>Su nombre o apodo</label>
					<input
						id={`${inputId}-new-display-name`}
						value={displayNameDraft}
						maxLength={VALENTINA_MEMORIES_DISPLAY_NAME_MAX_LENGTH}
						autoComplete="nickname"
						onChange={(event) => setDisplayNameDraft(event.target.value)}
					/>
					<button
						type="button"
						className="status-page__btn"
						disabled={!displayNameDraft.trim()}
						onClick={() => void startSession()}
					>
						Continuar
					</button>
				</section>
			)}

			{!originAllowed ? (
				<p className="status-page__status status-page__status--error" role="alert">
					{copy.officialOriginUnavailable}
				</p>
			) : null}

			{profile && status !== 'success' ? (
				<ValentinaMemoriesUploadPanel
					inputId={inputId}
					inputRef={inputRef}
					accept={ACCEPT}
					selectedFile={selectedFile}
					selectedPreviewUrl={selectedPreviewUrl}
					selectedCaption={selectedCaption}
					status={status}
					originAllowed={originAllowed}
					quota={quota}
					onFileChange={onFileChange}
					onCaptionChange={setSelectedCaption}
					onConfirmUpload={onConfirmUpload}
					onCancelSelection={onCancelSelection}
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
					{originAllowed ? (
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
									item.mimeType.startsWith('video/') ? (
										<video
											controls
											preload="metadata"
											src={`${ITEMS_ENDPOINT}/${encodeURIComponent(item.id)}`}
										/>
									) : (
										<img
											loading="lazy"
											src={`${ITEMS_ENDPOINT}/${encodeURIComponent(item.id)}`}
											alt={item.caption || copy.myMemories}
										/>
									)
								) : null}
								<p>{itemStatusLabel(item)}</p>
								{editingId === item.id ? (
									<div className="status-page__inline-controls">
										<input
											value={captionDraft}
											maxLength={VALENTINA_MEMORIES_MAX_CAPTION_LENGTH}
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
