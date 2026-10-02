import { useId, useMemo, useState, type FormEvent } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import {
	MemoryNoteFieldset,
	MemoryPlanFieldset,
	MemoryScheduleFieldset,
} from '@/components/dashboard/memories/MemorySpaceFormFields';
import { CLOUDFLARE_FREE_TIER } from '@/lib/platform/contract/limits';
import { formatMemoriesEventDate, memoriesFormCopy as copy } from '@/lib/memories/dashboard-copy';
import type { AdminSpaceCandidate } from '@/lib/memories/client/api';
import { checkMemoriesSchedule } from '@/lib/memories/client/schedule-check';
import {
	formFromCandidate,
	projectMemoriesCommitment,
	type MemorySpaceCommitment,
	type MemorySpaceFormState,
} from '@/lib/memories/client/space-form';

const DIACRITICS = new RegExp('\\p{Diacritic}', 'gu');

function normalizeSearch(value: string): string {
	return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim();
}

interface PickerProps {
	candidates: AdminSpaceCandidate[];
	today: string;
	onPick: (candidate: AdminSpaceCandidate) => void;
}

function CandidatePicker({ candidates, today, onPick }: PickerProps) {
	const searchId = useId();
	const [query, setQuery] = useState('');
	const [showPast, setShowPast] = useState(false);
	const sorted = useMemo(
		() =>
			[...candidates].sort((left, right) =>
				(left.eventDate ?? '9999').localeCompare(right.eventDate ?? '9999'),
			),
		[candidates],
	);
	const isPast = (candidate: AdminSpaceCandidate) =>
		candidate.eventDate !== null && candidate.eventDate < today;
	const pastCount = sorted.filter(isPast).length;
	const needle = normalizeSearch(query);
	const visible = sorted.filter(
		(candidate) =>
			(showPast || needle !== '' || !isPast(candidate)) &&
			normalizeSearch(candidate.eventTitle).includes(needle),
	);

	if (candidates.length === 0) return <p className="dashboard-form-help">{copy.pickerEmpty}</p>;

	return (
		<div className="memories-picker">
			<div className="dashboard-form-grid">
				<div className="dashboard-form-field">
					<label htmlFor={searchId}>{copy.pickerLabel}</label>
					<input
						id={searchId}
						type="search"
						value={query}
						placeholder={copy.pickerPlaceholder}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</div>
			</div>
			{visible.length === 0 ? (
				<p className="dashboard-form-help">{copy.pickerNoMatch}</p>
			) : null}
			<ul className="memories-picker__list">
				{visible.map((candidate) => (
					<li key={candidate.eventId}>
						<button
							type="button"
							className="memories-picker__option"
							onClick={() => onPick(candidate)}
						>
							<span>{candidate.eventTitle}</span>
							<small>
								{candidate.eventDate
									? formatMemoriesEventDate(candidate.eventDate)
									: copy.pickerNoDate}
							</small>
						</button>
					</li>
				))}
			</ul>
			{!showPast && needle === '' && pastCount > 0 ? (
				<button type="button" className="btn-secondary" onClick={() => setShowPast(true)}>
					{copy.showPast(pastCount)}
				</button>
			) : null}
		</div>
	);
}

interface FormProps {
	form: MemorySpaceFormState;
	mode: 'create' | 'edit';
	formId: string;
	commitment: MemorySpaceCommitment;
	acknowledged: boolean;
	error: string | null;
	onChange: (patch: Partial<MemorySpaceFormState>) => void;
	onAcknowledge: (value: boolean) => void;
	onSubmit: () => void;
}

function SpaceForm({
	form,
	mode,
	formId,
	commitment,
	acknowledged,
	error,
	onChange,
	onAcknowledge,
	onSubmit,
}: FormProps) {
	const idFor = (name: string) => `${formId}-${name}`;
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		onSubmit();
	};
	return (
		<form id={formId} className="memories-form" onSubmit={submit}>
			<MemoryScheduleFieldset
				form={form}
				schedule={checkMemoriesSchedule(form)}
				slugLocked={mode === 'edit'}
				idFor={idFor}
				onChange={onChange}
			/>
			<MemoryPlanFieldset
				form={form}
				projectedBytes={projectMemoriesCommitment(commitment, form.limits.maxEventBytes)}
				acknowledged={acknowledged}
				idFor={idFor}
				onChange={onChange}
				onAcknowledge={onAcknowledge}
			/>
			<MemoryNoteFieldset form={form} idFor={idFor} onChange={onChange} />
			{error ? (
				<p className="dashboard-error" role="alert">
					{error}
				</p>
			) : null}
		</form>
	);
}

/** A save needs a valid schedule and, past the free tier, an explicit acknowledgement. */
function canSubmitForm(
	form: MemorySpaceFormState,
	commitment: MemorySpaceCommitment,
	acknowledged: boolean,
): boolean {
	const over =
		projectMemoriesCommitment(commitment, form.limits.maxEventBytes) >
		CLOUDFLARE_FREE_TIER.r2StorageBytes;
	return checkMemoriesSchedule(form).valid && (!over || acknowledged);
}

function submitLabel(mode: 'create' | 'edit', busy: boolean): string {
	if (busy) return copy.saving;
	return mode === 'create' ? copy.submitCreate : copy.submitEdit;
}

interface Props {
	mode: 'create' | 'edit';
	candidates: AdminSpaceCandidate[];
	initial: MemorySpaceFormState | null;
	commitment: MemorySpaceCommitment;
	busy: boolean;
	error: string | null;
	onSubmit: (form: MemorySpaceFormState) => void;
	onClose: () => void;
}

export default function MemorySpaceFormModal({
	mode,
	candidates,
	initial,
	commitment,
	busy,
	error,
	onSubmit,
	onClose,
}: Props) {
	const [form, setForm] = useState<MemorySpaceFormState | null>(initial);
	const [acknowledged, setAcknowledged] = useState(false);
	const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
	const formId = useId();
	const canSubmit = form !== null && canSubmitForm(form, commitment, acknowledged);

	const footer = form ? (
		<>
			{mode === 'create' ? (
				<button
					type="button"
					className="btn-secondary"
					disabled={busy}
					onClick={() => setForm(null)}
				>
					{copy.back}
				</button>
			) : null}
			<button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>
				{copy.cancel}
			</button>
			<button
				type="submit"
				form={formId}
				className="btn-primary"
				disabled={busy || !canSubmit}
			>
				{submitLabel(mode, busy)}
			</button>
		</>
	) : undefined;

	const subtitle = form?.eventDate
		? copy.eventOn(form.eventTitle, formatMemoriesEventDate(form.eventDate))
		: form?.eventTitle;

	return (
		<ModalShell
			title={mode === 'create' ? copy.createTitle : copy.editTitle}
			subtitle={subtitle}
			onClose={onClose}
			disableClose={busy}
			size="lg"
			footer={footer}
		>
			<div className="dashboard-modal__content">
				{form ? (
					<SpaceForm
						form={form}
						mode={mode}
						formId={formId}
						commitment={commitment}
						acknowledged={acknowledged}
						error={error}
						onChange={(patch) => setForm({ ...form, ...patch })}
						onAcknowledge={setAcknowledged}
						onSubmit={() => {
							if (canSubmit) onSubmit(form);
						}}
					/>
				) : (
					<CandidatePicker
						candidates={candidates}
						today={today}
						onPick={(candidate) => setForm(formFromCandidate(candidate))}
					/>
				)}
			</div>
		</ModalShell>
	);
}
