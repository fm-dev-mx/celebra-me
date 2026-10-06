import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import {
	isMemoriesCatalogVisibleStatus,
	type MemoriesGuestProfile,
	type MemoriesGuestQuota,
	type MemoriesMediaPublicItem,
	type MemoriesSpaceSummary,
} from '@/lib/memories/contract/catalog';
import { MEMORIES_DISPLAY_NAME_MAX_LENGTH } from '@/lib/memories/contract/limits';
import { MEMORIES_ALLOWED_MIME_TYPES } from '@/lib/memories/contract/media-policy';
import { buildMemoriesPublicPath } from '@/lib/memories/contract/private-request';
import { formatMemoriesDateTime, memoriesCaptureCopy as copy } from '@/lib/memories/copy';
import { createMemoriesGuestApi } from '@/lib/memories/client/api';
import {
	classifyTransportIssue,
	mapRequestIssue,
	memoriesIssueCopy,
	type MemoriesCaptureIssue,
} from '@/lib/memories/client/media-prep';
import type { MemoriesPutTransport } from '@/lib/memories/client/upload-pipeline';
import {
	MemoriesUploadQueue,
	isMemoriesQueueActive,
	type MemoriesQueueEntry,
} from '@/lib/memories/client/upload-queue';
import {
	buildMemoriesCalendarFile,
	downloadMemoriesCalendarFile,
} from '@/lib/memories/client/calendar';
import MemoriesUploadPanel from '@/components/memories/MemoriesUploadPanel';
import MemoriesUploadProgress from '@/components/memories/MemoriesUploadProgress';
import MemoriesGuestMemories from '@/components/memories/MemoriesGuestMemories';

type CatalogItem = MemoriesMediaPublicItem;

type MemoriesCaptureProps = {
	space: MemoriesSpaceSummary;
	maxSessionVideos: number;
	readVideoDurationSeconds?: (file: File) => Promise<number>;
	optimizeImage?: (file: File, signal?: AbortSignal) => Promise<File>;
	putFile?: MemoriesPutTransport;
	/** Server-side reading at page load; the guest listing keeps it fresh. */
	eventFull?: boolean;
};

const ACCEPT = Object.keys(MEMORIES_ALLOWED_MIME_TYPES).join(',');

function SessionIssue({ issue }: { issue: MemoriesCaptureIssue | null }) {
	if (!issue) return null;
	return (
		<p className="status-page__status status-page__status--error" role="alert">
			{memoriesIssueCopy(issue)}
		</p>
	);
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
		<aside className="status-page__recovery-code" aria-labelledby="memories-recovery-title">
			<strong id="memories-recovery-title">{copy.recoveryCodeTitle}</strong>
			<span>{copy.recoveryCodeHint}</span>
			<code tabIndex={0}>{recoveryCode}</code>
			<button type="button" onClick={() => void copyCode()}>
				{copied ? copy.recoveryCodeCopied : copy.copyRecoveryCode}
			</button>
			<small>{copy.recoveryCodeManualHint}</small>
		</aside>
	);
}

function BeforeOpen({ space }: { space: MemoriesSpaceSummary }) {
	const addToCalendar = () => {
		const url = new URL(buildMemoriesPublicPath(space.publicSlug), window.location.origin);
		downloadMemoriesCalendarFile(
			buildMemoriesCalendarFile({
				uid: space.publicSlug,
				title: copy.calendarTitle(space.eventTitle),
				startsAt: space.uploadStartsAt,
				endsAt: space.uploadEndsAt,
				url: url.toString(),
			}),
			`recuerdos-${space.publicSlug}.ics`,
		);
	};
	return (
		<section className="memories-guest-before">
			<p>
				Podrá compartir sus fotos a partir del{' '}
				<strong>{formatMemoriesDateTime(space.uploadStartsAt, space.timeZone)}</strong>.
			</p>
			<button
				type="button"
				className="status-page__btn status-page__btn--outline"
				onClick={addToCalendar}
			>
				{copy.addToCalendar}
			</button>
		</section>
	);
}

function Onboarding({
	inputId,
	issue,
	onStart,
}: {
	inputId: string;
	issue: MemoriesCaptureIssue | null;
	onStart: (displayName: string) => Promise<void>;
}) {
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);
	return (
		<form
			className="status-page__onboarding"
			aria-label={copy.onboardingSectionLabel}
			onSubmit={(event) => {
				event.preventDefault();
				if (!name.trim() || busy) return;
				setBusy(true);
				void onStart(name).finally(() => setBusy(false));
			}}
		>
			<label htmlFor={`${inputId}-new-display-name`}>{copy.displayNameLabel}</label>
			<input
				id={`${inputId}-new-display-name`}
				value={name}
				maxLength={MEMORIES_DISPLAY_NAME_MAX_LENGTH}
				autoComplete="nickname"
				aria-describedby={`${inputId}-name-help`}
				onChange={(event) => setName(event.target.value)}
			/>
			<p id={`${inputId}-name-help`} className="status-page__hint">
				{copy.welcomeNameHelp}
			</p>
			<button type="submit" className="status-page__btn" disabled={!name.trim() || busy}>
				{copy.continueLabel}
			</button>
			<SessionIssue issue={issue} />
		</form>
	);
}

function Identity({
	inputId,
	profile,
	issue,
	onSave,
}: {
	inputId: string;
	profile: MemoriesGuestProfile;
	issue: MemoriesCaptureIssue | null;
	onSave: (displayName: string) => Promise<boolean>;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(profile.displayName);
	return (
		<section className="status-page__identity" aria-label={copy.profileSectionLabel}>
			{editing ? (
				<>
					<label htmlFor={`${inputId}-display-name`}>{copy.displayNameLabel}</label>
					<div className="status-page__inline-controls">
						<input
							id={`${inputId}-display-name`}
							value={draft}
							maxLength={MEMORIES_DISPLAY_NAME_MAX_LENGTH}
							onChange={(event) => setDraft(event.target.value)}
						/>
						<button
							type="button"
							disabled={!draft.trim()}
							onClick={() =>
								void onSave(draft).then((saved) => {
									if (saved) setEditing(false);
								})
							}
						>
							{copy.saveLabel}
						</button>
						<button type="button" onClick={() => setEditing(false)}>
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
						onClick={() => {
							setDraft(profile.displayName);
							setEditing(true);
						}}
					>
						{copy.changeName}
					</button>
				</p>
			)}
			<SessionIssue issue={issue} />
		</section>
	);
}

function BatchSummary({
	entries,
	displayName,
	recoveryCode,
	captionWarning,
	onUploadMore,
}: {
	entries: readonly MemoriesQueueEntry[];
	displayName: string;
	recoveryCode: string | null;
	captionWarning: boolean;
	onUploadMore: () => void;
}) {
	const saved = entries.filter(
		(entry) =>
			entry.status === 'done' && (entry.result === 'accepted' || entry.result === null),
	).length;
	const failed = entries.length - saved;
	return (
		<section className="status-page__success" aria-live="polite">
			{saved > 0 ? (
				<>
					<h2>{copy.thanks(displayName)}</h2>
					<p className="status-page__status" role="status">
						{copy.successCount(saved)}
					</p>
				</>
			) : (
				<h2>{copy.noneSaved}</h2>
			)}
			{saved > 0 && failed > 0 ? <p>{copy.failedCount(failed)}</p> : null}
			{captionWarning ? (
				<p className="status-page__status status-page__status--warning" role="status">
					{copy.captionSaveFailed}
				</p>
			) : null}
			{saved > 0 ? <RecoveryCodeCard recoveryCode={recoveryCode} /> : null}
			{saved > 0 ? (
				<div className="status-page__inline-actions">
					<button type="button" className="status-page__btn" onClick={onUploadMore}>
						{copy.uploadAnother}
					</button>
					<a href="#mis-recuerdos" className="status-page__btn status-page__btn--outline">
						{copy.viewMemories}
					</a>
				</div>
			) : (
				<button type="button" className="status-page__text-button" onClick={onUploadMore}>
					{copy.chooseOtherFiles}
				</button>
			)}
		</section>
	);
}

function useUploadQueue(deps: ConstructorParameters<typeof MemoriesUploadQueue>[0]['deps']) {
	const queueRef = useRef<MemoriesUploadQueue | null>(null);
	if (!queueRef.current) {
		queueRef.current = new MemoriesUploadQueue({
			deps,
			isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
		});
	}
	const queue = queueRef.current;
	const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
	useEffect(() => {
		const online = () => queue.setOnline(true);
		const offline = () => queue.setOnline(false);
		window.addEventListener('online', online);
		window.addEventListener('offline', offline);
		return () => {
			window.removeEventListener('online', online);
			window.removeEventListener('offline', offline);
			queue.dispose();
		};
	}, [queue]);
	return { queue, snapshot };
}

/** Guest island: name once, pick several files, follow each upload and see one's memories. */
export default function MemoriesCapture({
	space,
	maxSessionVideos,
	readVideoDurationSeconds,
	optimizeImage,
	putFile,
	eventFull: initialEventFull = false,
}: MemoriesCaptureProps) {
	const inputId = useId();
	const api = useMemo(() => createMemoriesGuestApi(space.publicSlug), [space.publicSlug]);
	const uploadsOpen = space.windowState === 'open';
	const [sessionIssue, setSessionIssue] = useState<MemoriesCaptureIssue | null>(null);
	const [profile, setProfile] = useState<MemoriesGuestProfile | null>(null);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const [items, setItems] = useState<CatalogItem[]>([]);
	const [quota, setQuota] = useState<MemoriesGuestQuota | null>(null);
	const [eventFull, setEventFull] = useState(initialEventFull);
	const { queue, snapshot } = useUploadQueue({
		api,
		putFile,
		optimizeImage,
		readVideoDurationSeconds,
	});
	const entries = snapshot.entries;

	const loadItems = useCallback(async () => {
		try {
			const payload = await api.listItems();
			setItems(payload.items.filter((item) => isMemoriesCatalogVisibleStatus(item.status)));
			setQuota(payload.quota);
			if (typeof payload.eventFull === 'boolean') setEventFull(payload.eventFull);
		} catch {
			// A later successful action refreshes the catalog.
		}
	}, [api]);

	useEffect(() => {
		void (async () => {
			try {
				const existingProfile = await api.getSession();
				if (!existingProfile) return;
				setProfile(existingProfile);
				await loadItems();
			} catch {
				setSessionIssue(classifyTransportIssue('unavailable'));
			}
		})();
		// The island mounts once per space.
	}, [api]);

	const doneCount = entries.filter((entry) => entry.status === 'done').length;
	useEffect(() => {
		if (doneCount > 0) void loadItems();
	}, [doneCount, loadItems]);

	const startSession = async (displayName: string) => {
		try {
			const created = await api.createSession(displayName);
			setProfile(created.profile);
			setSessionIssue(null);
			if (created.recoveryCode) setRecoveryCode(created.recoveryCode);
			await loadItems();
		} catch (error) {
			setSessionIssue(mapRequestIssue(error, 'unavailable'));
		}
	};

	const saveProfile = async (displayName: string): Promise<boolean> => {
		try {
			setProfile(await api.updateProfile(displayName));
			setSessionIssue(null);
			return true;
		} catch (error) {
			setSessionIssue(mapRequestIssue(error, 'unavailable'));
			return false;
		}
	};

	const saveCaption = async (item: CatalogItem, caption: string): Promise<boolean> => {
		try {
			await api.updateCaption(item.id, caption);
			await loadItems();
			return true;
		} catch {
			return false;
		}
	};

	const deleteItem = async (item: CatalogItem): Promise<boolean> => {
		try {
			await api.deleteItem(item.id);
			await loadItems();
			return true;
		} catch {
			return false;
		}
	};

	if (space.windowState === 'before') return <BeforeOpen space={space} />;

	const queued = entries.filter(
		(entry) => entry.status !== 'ready' && entry.status !== 'invalid',
	);
	const picked = entries.filter(
		(entry) => entry.status === 'ready' || entry.status === 'invalid',
	);
	const running = queued.some(
		(entry) => isMemoriesQueueActive(entry) || entry.status === 'waiting',
	);
	const captionWarning = queued.some((entry) => entry.status === 'done' && !entry.captionSaved);

	return (
		<div className="status-page__capture" data-capture="memories">
			{profile ? (
				<Identity
					inputId={inputId}
					profile={profile}
					issue={sessionIssue}
					onSave={saveProfile}
				/>
			) : (
				<Onboarding inputId={inputId} issue={sessionIssue} onStart={startSession} />
			)}

			{profile && uploadsOpen && eventFull && queued.length === 0 ? (
				<section className="memories-notice memories-notice--warning" role="status">
					<p>
						<strong>{copy.eventFullTitle}.</strong> {copy.eventFullBody}
					</p>
				</section>
			) : null}

			{profile && uploadsOpen && !eventFull && queued.length === 0 ? (
				<MemoriesUploadPanel
					inputId={inputId}
					accept={ACCEPT}
					maxSessionVideos={maxSessionVideos}
					entries={picked}
					quota={quota}
					onFilesSelected={(files) => queue.add(files)}
					onRemove={(id) => queue.remove(id)}
					onStart={(caption) => queue.start(caption)}
					onCancel={() => queue.cancelPending()}
				/>
			) : null}

			{profile && queued.length > 0 ? (
				<>
					{!running ? (
						<BatchSummary
							entries={queued}
							displayName={profile.displayName}
							recoveryCode={recoveryCode}
							captionWarning={captionWarning}
							onUploadMore={() => {
								queue.clearFinished();
								setRecoveryCode(null);
							}}
						/>
					) : null}
					<MemoriesUploadProgress
						entries={queued}
						offline={snapshot.offline}
						canRetry={uploadsOpen}
						onRetry={(id) => queue.retry(id)}
						onCancelPending={() => queue.cancelPending()}
					/>
				</>
			) : null}

			{profile ? (
				<MemoriesGuestMemories
					items={items}
					mediaUrl={api.itemMediaUrl}
					thumbnailUrl={(item) => api.itemThumbnailUrl(item.id)}
					onSaveCaption={saveCaption}
					onDelete={deleteItem}
				/>
			) : null}
		</div>
	);
}
