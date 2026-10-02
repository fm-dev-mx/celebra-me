import { useId, useMemo, useState, type FormEvent } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import MemoriesCapacityExamples from '@/components/dashboard/memories/MemoriesCapacityExamples';
import type { MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';
import {
	MEMORIES_ENTITLEMENTS,
	MEMORIES_LIMIT_PROFILES,
	type MemoriesEntitlement,
	type MemoriesLimitProfile,
	type MemoriesSpaceLimits,
} from '@/lib/memories/contract/limits';
import { buildMemoriesPublicUrl } from '@/lib/memories/contract/private-request';
import {
	MEMORIES_BINARY_MB,
	MEMORIES_DECIMAL_GB,
	MEMORIES_ENTITLEMENT_LABEL,
	formatMemoriesStorage,
	memoriesFormCopy as copy,
} from '@/lib/memories/dashboard-copy';
import type { AdminSpaceCandidate } from '@/lib/memories/client/api';

export type MemorySpaceFormState = {
	eventId: string;
	eventTitle: string;
	publicSlug: string;
	timeZone: string;
	uploadStartsLocal: string;
	uploadEndsLocal: string;
	retentionEndsLocal: string;
	entitlement: MemoriesEntitlement;
	limits: MemoriesSpaceLimits;
};

/** Zones used by current clients; any other stored zone is kept as an extra option. */
const COMMON_TIME_ZONES = [
	'America/Mexico_City',
	'America/Mazatlan',
	'America/Tijuana',
	'America/Hermosillo',
	'America/Chihuahua',
	'America/Monterrey',
	'America/Cancun',
];

const PROFILE_LABEL: Record<MemoriesLimitProfile, string> = {
	standard: copy.profileStandard,
	extended: copy.profileExtended,
};

export function formFromCandidate(candidate: AdminSpaceCandidate): MemorySpaceFormState {
	return {
		eventId: candidate.eventId,
		eventTitle: candidate.eventTitle,
		publicSlug: candidate.defaults.publicSlug,
		timeZone: candidate.defaults.timeZone,
		uploadStartsLocal: candidate.defaults.uploadStartsLocal,
		uploadEndsLocal: candidate.defaults.uploadEndsLocal,
		retentionEndsLocal: candidate.defaults.retentionEndsLocal,
		entitlement: 'addon',
		limits: { ...candidate.defaults.limits },
	};
}

function toLocalInput(iso: string, timeZone: string): string {
	try {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
		}).formatToParts(new Date(iso));
		const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '00';
		return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
	} catch {
		return iso.slice(0, 16);
	}
}

export function formFromSpace(space: MemoriesSpaceRecord): MemorySpaceFormState {
	return {
		eventId: space.eventId,
		eventTitle: space.eventTitle,
		publicSlug: space.publicSlug,
		timeZone: space.timeZone,
		uploadStartsLocal: toLocalInput(space.uploadStartsAt, space.timeZone),
		uploadEndsLocal: toLocalInput(space.uploadEndsAt, space.timeZone),
		retentionEndsLocal: toLocalInput(space.retentionEndsAt, space.timeZone),
		entitlement: space.entitlement,
		limits: {
			maxEventObjects: space.maxEventObjects,
			maxEventBytes: space.maxEventBytes,
			maxSessionFiles: space.maxSessionFiles,
			maxSessionVideos: space.maxSessionVideos,
			maxSessionBytes: space.maxSessionBytes,
		},
	};
}

function matchProfile(limits: MemoriesSpaceLimits): MemoriesLimitProfile | 'custom' {
	const entries = Object.entries(MEMORIES_LIMIT_PROFILES) as Array<
		[MemoriesLimitProfile, MemoriesSpaceLimits]
	>;
	const match = entries.find(([, preset]) =>
		(Object.keys(preset) as Array<keyof MemoriesSpaceLimits>).every(
			(key) => preset[key] === limits[key],
		),
	);
	return match ? match[0] : 'custom';
}

function normalizeSearch(value: string): string {
	return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
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
							<small>{candidate.eventDate ?? 'Fecha sin definir'}</small>
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

interface Props {
	mode: 'create' | 'edit';
	candidates: AdminSpaceCandidate[];
	initial: MemorySpaceFormState | null;
	busy: boolean;
	error: string | null;
	onSubmit: (form: MemorySpaceFormState) => void;
	onClose: () => void;
}

export default function MemorySpaceFormModal({
	mode,
	candidates,
	initial,
	busy,
	error,
	onSubmit,
	onClose,
}: Props) {
	const [form, setForm] = useState<MemorySpaceFormState | null>(initial);
	const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
	const fieldId = useId();
	const id = (name: string) => `${fieldId}-${name}`;

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (form) onSubmit(form);
	};

	const setLimit = (key: keyof MemoriesSpaceLimits, value: number) =>
		setForm((current) =>
			current ? { ...current, limits: { ...current.limits, [key]: value } } : current,
		);

	const title = mode === 'create' ? copy.createTitle : copy.editTitle;
	const profile = form ? matchProfile(form.limits) : 'custom';
	const timeZones =
		form && !COMMON_TIME_ZONES.includes(form.timeZone)
			? [form.timeZone, ...COMMON_TIME_ZONES]
			: COMMON_TIME_ZONES;

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
			<button type="submit" form={id('form')} className="btn-primary" disabled={busy}>
				{busy ? copy.saving : mode === 'create' ? copy.submitCreate : copy.submitEdit}
			</button>
		</>
	) : undefined;

	return (
		<ModalShell
			title={title}
			subtitle={form?.eventTitle}
			onClose={onClose}
			disableClose={busy}
			size="lg"
			footer={footer}
		>
			<div className="dashboard-modal__content">
				{!form ? (
					<CandidatePicker
						candidates={candidates}
						today={today}
						onPick={(candidate) => setForm(formFromCandidate(candidate))}
					/>
				) : (
					<form id={id('form')} className="memories-form" onSubmit={submit}>
						<fieldset>
							<legend>{copy.windowSection}</legend>
							<div className="dashboard-form-grid">
								<div className="dashboard-form-field">
									<label htmlFor={id('slug')}>{copy.slug}</label>
									<input
										id={id('slug')}
										value={form.publicSlug}
										disabled={mode === 'edit'}
										onChange={(event) =>
											setForm({ ...form, publicSlug: event.target.value })
										}
									/>
									<small className="dashboard-form-help">
										{buildMemoriesPublicUrl(form.publicSlug || '…')}
										{mode === 'create' ? ` · ${copy.slugHelp}` : null}
									</small>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor={id('tz')}>{copy.timeZone}</label>
									<select
										id={id('tz')}
										value={form.timeZone}
										onChange={(event) =>
											setForm({ ...form, timeZone: event.target.value })
										}
									>
										{timeZones.map((zone) => (
											<option key={zone} value={zone}>
												{zone}
											</option>
										))}
									</select>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor={id('starts')}>{copy.uploadStarts}</label>
									<input
										id={id('starts')}
										type="datetime-local"
										value={form.uploadStartsLocal}
										onChange={(event) =>
											setForm({
												...form,
												uploadStartsLocal: event.target.value,
											})
										}
									/>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor={id('ends')}>{copy.uploadEnds}</label>
									<input
										id={id('ends')}
										type="datetime-local"
										value={form.uploadEndsLocal}
										onChange={(event) =>
											setForm({
												...form,
												uploadEndsLocal: event.target.value,
											})
										}
									/>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor={id('retention')}>{copy.retentionEnds}</label>
									<input
										id={id('retention')}
										type="datetime-local"
										value={form.retentionEndsLocal}
										onChange={(event) =>
											setForm({
												...form,
												retentionEndsLocal: event.target.value,
											})
										}
									/>
									<small className="dashboard-form-help">
										{copy.retentionHelp}
									</small>
								</div>
							</div>
						</fieldset>

						<fieldset>
							<legend>{copy.planSection}</legend>
							<div className="dashboard-form-grid">
								<div className="dashboard-form-field">
									<label htmlFor={id('entitlement')}>{copy.entitlement}</label>
									<select
										id={id('entitlement')}
										value={form.entitlement}
										onChange={(event) =>
											setForm({
												...form,
												entitlement: event.target
													.value as MemoriesEntitlement,
											})
										}
									>
										{MEMORIES_ENTITLEMENTS.map((entitlement) => (
											<option key={entitlement} value={entitlement}>
												{MEMORIES_ENTITLEMENT_LABEL[entitlement]}
											</option>
										))}
									</select>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor={id('profile')}>{copy.profile}</label>
									<select
										id={id('profile')}
										value={profile}
										onChange={(event) => {
											const next = event.target.value;
											if (next in MEMORIES_LIMIT_PROFILES) {
												setForm({
													...form,
													limits: {
														...MEMORIES_LIMIT_PROFILES[
															next as MemoriesLimitProfile
														],
													},
												});
											}
										}}
									>
										{(
											Object.keys(
												MEMORIES_LIMIT_PROFILES,
											) as MemoriesLimitProfile[]
										).map((key) => (
											<option key={key} value={key}>
												{PROFILE_LABEL[key]}
											</option>
										))}
										<option value="custom" disabled={profile !== 'custom'}>
											{copy.profileCustom}
										</option>
									</select>
								</div>
							</div>
							<p className="dashboard-form-help">
								{copy.limitsSummary({
									eventStorage: formatMemoriesStorage(form.limits.maxEventBytes),
									eventObjects: form.limits.maxEventObjects,
									sessionFiles: form.limits.maxSessionFiles,
									sessionVideos: form.limits.maxSessionVideos,
									sessionStorage: formatMemoriesStorage(
										form.limits.maxSessionBytes,
									),
								})}
							</p>
							<MemoriesCapacityExamples limits={form.limits} />
							<details className="memories-form__custom" open={profile === 'custom'}>
								<summary>{copy.customLimits}</summary>
								<div className="dashboard-form-grid">
									<div className="dashboard-form-field">
										<label htmlFor={id('event-gb')}>{copy.maxEventBytes}</label>
										<input
											id={id('event-gb')}
											type="number"
											min={0.1}
											step={0.1}
											value={form.limits.maxEventBytes / MEMORIES_DECIMAL_GB}
											onChange={(event) =>
												setLimit(
													'maxEventBytes',
													Math.round(
														Number(event.target.value) *
															MEMORIES_DECIMAL_GB,
													),
												)
											}
										/>
									</div>
									<div className="dashboard-form-field">
										<label htmlFor={id('event-objects')}>
											{copy.maxEventObjects}
										</label>
										<input
											id={id('event-objects')}
											type="number"
											min={1}
											value={form.limits.maxEventObjects}
											onChange={(event) =>
												setLimit(
													'maxEventObjects',
													Number(event.target.value),
												)
											}
										/>
									</div>
									<div className="dashboard-form-field">
										<label htmlFor={id('session-files')}>
											{copy.maxSessionFiles}
										</label>
										<input
											id={id('session-files')}
											type="number"
											min={1}
											value={form.limits.maxSessionFiles}
											onChange={(event) =>
												setLimit(
													'maxSessionFiles',
													Number(event.target.value),
												)
											}
										/>
									</div>
									<div className="dashboard-form-field">
										<label htmlFor={id('session-videos')}>
											{copy.maxSessionVideos}
										</label>
										<input
											id={id('session-videos')}
											type="number"
											min={0}
											value={form.limits.maxSessionVideos}
											onChange={(event) =>
												setLimit(
													'maxSessionVideos',
													Number(event.target.value),
												)
											}
										/>
									</div>
									<div className="dashboard-form-field">
										<label htmlFor={id('session-mb')}>
											{copy.maxSessionBytes}
										</label>
										<input
											id={id('session-mb')}
											type="number"
											min={1}
											value={Math.round(
												form.limits.maxSessionBytes / MEMORIES_BINARY_MB,
											)}
											onChange={(event) =>
												setLimit(
													'maxSessionBytes',
													Math.round(Number(event.target.value)) *
														MEMORIES_BINARY_MB,
												)
											}
										/>
									</div>
								</div>
							</details>
						</fieldset>

						{error ? (
							<p className="dashboard-error" role="alert">
								{error}
							</p>
						) : null}
					</form>
				)}
			</div>
		</ModalShell>
	);
}
