import { useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';
import {
	resolveMemoriesWindowState,
	type MemoriesAdminSpaceItem,
	type MemoriesAdminTotals,
	type MemoriesReadiness,
} from '@/lib/memories/contract/catalog';
import { buildMemoriesPublicUrl } from '@/lib/memories/contract/private-request';
import {
	MEMORIES_WINDOW_ORDER,
	describeMemoriesLoadError,
	formatMemoriesStorage,
	type MemoriesLoadErrorGuide,
	memoriesAdminCopy as copy,
	memoriesFormCopy,
} from '@/lib/memories/dashboard-copy';
import {
	MemoriesRequestError,
	memoriesAdminApi,
	type AdminSpaceCandidate,
} from '@/lib/memories/client/api';
import { CLOUDFLARE_FREE_TIER } from '@/lib/platform/contract/limits';
import MemorySpaceCard, {
	resolveUndownloadedDeletionDays,
} from '@/components/dashboard/memories/MemorySpaceCard';
import { committedMemoriesBytes } from '@/lib/memories/contract/capacity';
import MemorySpaceFormModal from '@/components/dashboard/memories/MemorySpaceFormModal';
import MemoriesConfigNotices from '@/components/dashboard/memories/MemoriesConfigNotices';
import {
	formFromSpace,
	type MemorySpaceCommitment,
	type MemorySpaceFormState,
} from '@/lib/memories/client/space-form';

type FormModal =
	| { mode: 'create'; initial: null; item: null }
	| { mode: 'edit'; initial: MemorySpaceFormState; item: MemoriesAdminSpaceItem };

const EMPTY_TOTALS: MemoriesAdminTotals = { residentBytes: 0, committedBytes: 0 };

function readFormError(error: unknown): string {
	if (error instanceof MemoriesRequestError && error.code === 'validation_error') {
		return memoriesFormCopy.validationError;
	}
	if (error instanceof MemoriesRequestError && error.status === 409) {
		return memoriesFormCopy.conflictError;
	}
	return memoriesFormCopy.saveError;
}

function MemoriesAdmin() {
	const [items, setItems] = useState<MemoriesAdminSpaceItem[]>([]);
	const [totals, setTotals] = useState<MemoriesAdminTotals>(EMPTY_TOTALS);
	const [candidates, setCandidates] = useState<AdminSpaceCandidate[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [loadFailure, setLoadFailure] = useState<MemoriesLoadErrorGuide | null>(null);
	const [readiness, setReadiness] = useState<MemoriesReadiness | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [modal, setModal] = useState<FormModal | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [confirmToggle, setConfirmToggle] = useState<MemoriesAdminSpaceItem | null>(null);
	const [busy, setBusy] = useState(false);
	const now = useMemo(() => new Date(), [items]);

	const load = async () => {
		setLoading(true);
		try {
			const payload = await memoriesAdminApi.list();
			setItems(payload.items);
			setTotals(payload.totals);
			setCandidates(payload.candidates);
			setReadiness(payload.readiness ?? null);
			setLoadFailure(null);
		} catch (failure) {
			setLoadFailure(
				describeMemoriesLoadError(
					failure instanceof MemoriesRequestError ? failure : { status: null },
				),
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load();
	}, []);
	const { current, expired } = useMemo(() => {
		const withState = items.map((item) => ({
			item,
			state: resolveMemoriesWindowState(item, now),
		}));
		// Spaces about to be deleted without a host download lead the list.
		const urgency = (item: MemoriesAdminSpaceItem) =>
			resolveUndownloadedDeletionDays(item, now) === null ? 1 : 0;
		withState.sort(
			(left, right) =>
				urgency(left.item) - urgency(right.item) ||
				MEMORIES_WINDOW_ORDER[left.state] - MEMORIES_WINDOW_ORDER[right.state] ||
				left.item.uploadStartsAt.localeCompare(right.item.uploadStartsAt),
		);
		return {
			current: withState
				.filter((entry) => entry.state !== 'expired')
				.map((entry) => entry.item),
			expired: withState
				.filter((entry) => entry.state === 'expired')
				.map((entry) => entry.item),
		};
	}, [items, now]);

	const deletionCount = current.filter(
		(item) => resolveUndownloadedDeletionDays(item, now) !== null,
	).length;

	const committedOver = totals.committedBytes > CLOUDFLARE_FREE_TIER.r2StorageBytes;

	const commitment = useMemo((): MemorySpaceCommitment => {
		const item = modal?.item;
		if (!item) return { otherBytes: totals.committedBytes, ownResidentBytes: 0, ownLive: true };
		const state = resolveMemoriesWindowState(item, now);
		const own = committedMemoriesBytes(state, item.maxEventBytes, item.usage.residentBytes);
		return {
			otherBytes: Math.max(0, totals.committedBytes - own),
			ownResidentBytes: item.usage.residentBytes,
			ownLive: state === 'before' || state === 'open',
		};
	}, [modal, totals, now]);

	const openCreate = () => {
		setFormError(null);
		setNotice(null);
		setModal({ mode: 'create', initial: null, item: null });
	};

	const openEdit = (item: MemoriesAdminSpaceItem) => {
		setFormError(null);
		setNotice(null);
		setModal({ mode: 'edit', initial: formFromSpace(item), item });
	};

	const submit = async (form: MemorySpaceFormState) => {
		if (!modal) return;
		setBusy(true);
		setFormError(null);
		const body = {
			timeZone: form.timeZone,
			uploadStartsLocal: form.uploadStartsLocal,
			uploadEndsLocal: form.uploadEndsLocal,
			retentionEndsLocal: form.retentionEndsLocal,
			entitlement: form.entitlement,
			limits: form.limits,
			expectedGuests: form.expectedGuests,
			adminNote: form.adminNote.trim() === '' ? null : form.adminNote.trim(),
		};
		try {
			if (modal.mode === 'create') {
				const created = await memoriesAdminApi.create({
					...body,
					eventId: form.eventId,
					publicSlug: form.publicSlug,
					enabled: true,
				});
				setNotice(copy.created(buildMemoriesPublicUrl(created.publicSlug)));
			} else {
				await memoriesAdminApi.update(form.eventId, body);
				setNotice(copy.updated);
			}
			setModal(null);
			await load();
		} catch (caught) {
			setFormError(readFormError(caught));
		} finally {
			setBusy(false);
		}
	};

	const toggle = async (item: MemoriesAdminSpaceItem) => {
		setBusy(true);
		setError(null);
		try {
			await memoriesAdminApi.update(item.eventId, { enabled: !item.enabled });
			setNotice(item.enabled ? copy.paused : copy.resumed);
			setConfirmToggle(null);
			await load();
		} catch {
			setConfirmToggle(null);
			setError(copy.toggleError);
		} finally {
			setBusy(false);
		}
	};

	const copyUrl = async (url: string) => {
		try {
			await navigator.clipboard.writeText(url);
			setNotice(copy.copied);
		} catch {
			setNotice(url);
		}
	};

	const renderCard = (item: MemoriesAdminSpaceItem) => (
		<MemorySpaceCard
			key={item.eventId}
			item={item}
			now={now}
			busy={busy}
			onEdit={openEdit}
			onToggle={setConfirmToggle}
			onCopy={(url) => void copyUrl(url)}
		/>
	);

	return (
		<section className="dashboard-main memories-admin">
			<div className="memories-admin__toolbar">
				<button type="button" className="btn-primary" disabled={busy} onClick={openCreate}>
					{copy.activate}
				</button>
			</div>

			{loadFailure ? (
				<div className="dashboard-error memories-admin__load-error" role="alert">
					<p className="memories-admin__load-error-title">
						{copy.loadError} {loadFailure.title}
					</p>
					<ol className="memories-admin__load-error-steps">
						{loadFailure.steps.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>
					<button
						type="button"
						className="btn-secondary"
						disabled={loading}
						onClick={() => void load()}
					>
						{copy.retry}
					</button>
				</div>
			) : null}
			<MemoriesConfigNotices readiness={readiness} />
			{error ? (
				<p className="dashboard-error" role="alert">
					{error}
				</p>
			) : null}
			{notice ? (
				<p className="dashboard-status" role="status">
					{notice}
				</p>
			) : null}

			{deletionCount > 0 ? (
				<p className="memories-admin__deletion" role="alert">
					{copy.deletionNotice(deletionCount)}
				</p>
			) : null}

			<p
				className={`memories-admin__committed${committedOver ? ' memories-admin__committed--over' : ''}`}
				role={committedOver ? 'alert' : undefined}
			>
				{copy.committed(
					formatMemoriesStorage(totals.committedBytes),
					formatMemoriesStorage(CLOUDFLARE_FREE_TIER.r2StorageBytes),
				)}
				{committedOver ? ` ${copy.committedOver}` : null}
			</p>

			{loading && items.length === 0 ? <p className="dashboard-status">Cargando…</p> : null}
			{!loading && items.length === 0 && !error && !loadFailure ? (
				<div className="dashboard-card">
					<p>{copy.empty}</p>
				</div>
			) : null}

			<div className="memories-admin__spaces">{current.map(renderCard)}</div>

			{expired.length > 0 ? (
				<details className="memories-admin__expired">
					<summary>{copy.expiredSummary(expired.length)}</summary>
					<div className="memories-admin__spaces">{expired.map(renderCard)}</div>
				</details>
			) : null}

			{modal ? (
				<MemorySpaceFormModal
					mode={modal.mode}
					candidates={candidates}
					initial={modal.initial}
					commitment={commitment}
					busy={busy}
					error={formError}
					onSubmit={(form) => void submit(form)}
					onClose={() => setModal(null)}
				/>
			) : null}

			{confirmToggle ? (
				<ConfirmModal
					title={confirmToggle.enabled ? copy.pauseTitle : copy.resumeTitle}
					message={
						confirmToggle.enabled
							? copy.pauseMessage(confirmToggle.eventTitle)
							: copy.resumeMessage(confirmToggle.eventTitle)
					}
					confirmLabel={confirmToggle.enabled ? copy.pause : copy.resume}
					destructive={confirmToggle.enabled}
					loading={busy}
					onConfirm={() => void toggle(confirmToggle)}
					onCancel={() => setConfirmToggle(null)}
				/>
			) : null}
		</section>
	);
}

export default function MemoriesAdminWithErrorBoundary() {
	return (
		<ErrorBoundary>
			<MemoriesAdmin />
		</ErrorBoundary>
	);
}
