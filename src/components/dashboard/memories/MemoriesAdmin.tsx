import { useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';
import {
	resolveMemoriesWindowState,
	type MemoriesAdminSpaceItem,
	type MemoriesAdminTotals,
	type MemoriesPlatformUsage as PlatformUsage,
} from '@/lib/memories/contract/catalog';
import { buildMemoriesPublicUrl } from '@/lib/memories/contract/private-request';
import {
	MEMORIES_WINDOW_ORDER,
	memoriesAdminCopy as copy,
	memoriesFormCopy,
} from '@/lib/memories/dashboard-copy';
import {
	MemoriesRequestError,
	memoriesAdminApi,
	type AdminSpaceCandidate,
} from '@/lib/memories/client/api';
import MemoriesPlatformUsage from '@/components/dashboard/memories/MemoriesPlatformUsage';
import MemorySpaceCard from '@/components/dashboard/memories/MemorySpaceCard';
import MemorySpaceFormModal, {
	formFromSpace,
	type MemorySpaceFormState,
} from '@/components/dashboard/memories/MemorySpaceFormModal';

type FormModal =
	{ mode: 'create'; initial: null } | { mode: 'edit'; initial: MemorySpaceFormState };

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
	const [platform, setPlatform] = useState<PlatformUsage | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
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
			setError(null);
		} catch {
			setError(copy.loadError);
		} finally {
			setLoading(false);
		}
	};

	const loadPlatform = async () => {
		try {
			setPlatform(await memoriesAdminApi.platformUsage());
		} catch {
			setPlatform({ kind: 'unavailable' });
		}
	};

	useEffect(() => {
		void load();
		void loadPlatform();
	}, []);

	const { current, expired } = useMemo(() => {
		const withState = items.map((item) => ({
			item,
			state: resolveMemoriesWindowState(item, now),
		}));
		withState.sort(
			(left, right) =>
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

	const openCreate = () => {
		setFormError(null);
		setNotice(null);
		setModal({ mode: 'create', initial: null });
	};

	const openEdit = (item: MemoriesAdminSpaceItem) => {
		setFormError(null);
		setNotice(null);
		setModal({ mode: 'edit', initial: formFromSpace(item) });
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

			<MemoriesPlatformUsage usage={platform} totals={totals} />

			{loading && items.length === 0 ? <p className="dashboard-status">Cargando…</p> : null}
			{!loading && items.length === 0 && !error ? (
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
