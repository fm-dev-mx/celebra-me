import MemoriesCapacityExamples from '@/components/dashboard/memories/MemoriesCapacityExamples';
import {
	MEMORIES_ADMIN_NOTE_MAX_LENGTH,
	MEMORIES_ENTITLEMENTS,
	MEMORIES_EXPECTED_GUESTS_MAX,
	MEMORIES_LIMIT_PROFILES,
	MEMORIES_OBJECT_MAX_LIFETIME_DAYS,
	type MemoriesEntitlement,
	type MemoriesLimitProfile,
	type MemoriesSpaceLimits,
} from '@/lib/memories/contract/limits';
import { CLOUDFLARE_FREE_TIER } from '@/lib/platform/contract/limits';
import {
	MEMORIES_MAX_IMAGE_BYTES,
	MEMORIES_MAX_VIDEO_BYTES,
	MEMORIES_MAX_VIDEO_DURATION_SECONDS,
} from '@/lib/memories/contract/media-policy';
import { buildMemoriesPublicUrl } from '@/lib/memories/contract/private-request';
import {
	MEMORIES_BINARY_MB,
	MEMORIES_DECIMAL_GB,
	MEMORIES_ENTITLEMENT_LABEL,
	formatMemoriesStorage,
	memoriesFormCopy as copy,
} from '@/lib/memories/dashboard-copy';
import type {
	MemoriesScheduleCheck,
	MemoriesScheduleIssue,
} from '@/lib/memories/client/schedule-check';
import {
	MEMORIES_COMMON_TIME_ZONES,
	matchMemoriesLimitProfile,
	type MemorySpaceFormState,
} from '@/lib/memories/client/space-form';

type Change = (patch: Partial<MemorySpaceFormState>) => void;
type IdFor = (name: string) => string;

const PROFILE_LABEL: Record<MemoriesLimitProfile, string> = {
	standard: copy.profileStandard,
	extended: copy.profileExtended,
};

function megabytes(bytes: number): string {
	return `${Math.round(bytes / MEMORIES_BINARY_MB)} MB`;
}

function issueText(issue: MemoriesScheduleIssue | null): string | null {
	if (!issue) return null;
	return issue === 'retention_too_long'
		? copy.scheduleIssue.retention_too_long(MEMORIES_OBJECT_MAX_LIFETIME_DAYS)
		: copy.scheduleIssue[issue];
}

interface DateTimeFieldProps {
	id: string;
	label: string;
	value: string;
	issue: MemoriesScheduleIssue | null;
	help?: string;
	onChange: (value: string) => void;
}

function DateTimeField({ id, label, value, issue, help, onChange }: DateTimeFieldProps) {
	const text = issueText(issue);
	return (
		<div className="dashboard-form-field">
			<label htmlFor={id}>{label}</label>
			<input
				id={id}
				type="datetime-local"
				value={value}
				aria-invalid={Boolean(issue)}
				aria-describedby={text ? `${id}-issue` : undefined}
				onChange={(event) => onChange(event.target.value)}
			/>
			{text ? (
				<small id={`${id}-issue`} className="memories-form__issue" role="alert">
					{text}
				</small>
			) : null}
			{help ? <small className="dashboard-form-help">{help}</small> : null}
		</div>
	);
}

function scheduleSummary(schedule: MemoriesScheduleCheck): string {
	const parts: string[] = [];
	if (schedule.daysBeforeEvent !== null && schedule.daysAfterEvent !== null) {
		parts.push(copy.scheduleAroundEvent(schedule.daysBeforeEvent, schedule.daysAfterEvent));
	}
	if (schedule.retentionDays !== null) {
		parts.push(copy.retentionSpan(schedule.retentionDays, MEMORIES_OBJECT_MAX_LIFETIME_DAYS));
	}
	return parts.join(' ');
}

interface ScheduleProps {
	form: MemorySpaceFormState;
	schedule: MemoriesScheduleCheck;
	slugLocked: boolean;
	idFor: IdFor;
	onChange: Change;
}

export function MemoryScheduleFieldset({
	form,
	schedule,
	slugLocked,
	idFor,
	onChange,
}: ScheduleProps) {
	const timeZones = MEMORIES_COMMON_TIME_ZONES.includes(form.timeZone)
		? MEMORIES_COMMON_TIME_ZONES
		: [form.timeZone, ...MEMORIES_COMMON_TIME_ZONES];
	const summary = scheduleSummary(schedule);

	return (
		<fieldset>
			<legend>{copy.windowSection}</legend>
			<div className="dashboard-form-grid">
				<div className="dashboard-form-field">
					<label htmlFor={idFor('slug')}>{copy.slug}</label>
					<input
						id={idFor('slug')}
						value={form.publicSlug}
						disabled={slugLocked}
						onChange={(event) => onChange({ publicSlug: event.target.value })}
					/>
					<small className="dashboard-form-help">
						{buildMemoriesPublicUrl(form.publicSlug || '…')}
						{slugLocked ? null : ` · ${copy.slugHelp}`}
					</small>
				</div>
				<div className="dashboard-form-field">
					<label htmlFor={idFor('tz')}>{copy.timeZone}</label>
					<select
						id={idFor('tz')}
						value={form.timeZone}
						onChange={(event) => onChange({ timeZone: event.target.value })}
					>
						{timeZones.map((zone) => (
							<option key={zone} value={zone}>
								{zone}
							</option>
						))}
					</select>
				</div>
				<DateTimeField
					id={idFor('starts')}
					label={copy.uploadStarts}
					value={form.uploadStartsLocal}
					issue={schedule.startsIssue}
					onChange={(uploadStartsLocal) => onChange({ uploadStartsLocal })}
				/>
				<DateTimeField
					id={idFor('ends')}
					label={copy.uploadEnds}
					value={form.uploadEndsLocal}
					issue={schedule.endsIssue}
					onChange={(uploadEndsLocal) => onChange({ uploadEndsLocal })}
				/>
				<DateTimeField
					id={idFor('retention')}
					label={copy.retentionEnds}
					value={form.retentionEndsLocal}
					issue={schedule.retentionIssue}
					help={copy.retentionHelp}
					onChange={(retentionEndsLocal) => onChange({ retentionEndsLocal })}
				/>
			</div>
			{summary ? <p className="dashboard-form-help">{summary}</p> : null}
		</fieldset>
	);
}

interface LimitFieldProps {
	id: string;
	label: string;
	value: number;
	min: number;
	step?: number;
	onChange: (value: number) => void;
}

function LimitField({ id, label, value, min, step, onChange }: LimitFieldProps) {
	return (
		<div className="dashboard-form-field">
			<label htmlFor={id}>{label}</label>
			<input
				id={id}
				type="number"
				min={min}
				step={step}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
			/>
		</div>
	);
}

interface CustomLimitsProps {
	limits: MemoriesSpaceLimits;
	open: boolean;
	idFor: IdFor;
	onChange: (limits: MemoriesSpaceLimits) => void;
}

function CustomLimits({ limits, open, idFor, onChange }: CustomLimitsProps) {
	const set = (key: keyof MemoriesSpaceLimits, value: number) =>
		onChange({ ...limits, [key]: value });
	return (
		<details className="memories-form__custom" open={open}>
			<summary>{copy.customLimits}</summary>
			<div className="dashboard-form-grid">
				<LimitField
					id={idFor('event-gb')}
					label={copy.maxEventBytes}
					min={0.1}
					step={0.1}
					value={limits.maxEventBytes / MEMORIES_DECIMAL_GB}
					onChange={(value) =>
						set('maxEventBytes', Math.round(value * MEMORIES_DECIMAL_GB))
					}
				/>
				<LimitField
					id={idFor('event-objects')}
					label={copy.maxEventObjects}
					min={1}
					value={limits.maxEventObjects}
					onChange={(value) => set('maxEventObjects', value)}
				/>
				<LimitField
					id={idFor('session-files')}
					label={copy.maxSessionFiles}
					min={1}
					value={limits.maxSessionFiles}
					onChange={(value) => set('maxSessionFiles', value)}
				/>
				<LimitField
					id={idFor('session-videos')}
					label={copy.maxSessionVideos}
					min={0}
					value={limits.maxSessionVideos}
					onChange={(value) => set('maxSessionVideos', value)}
				/>
				<LimitField
					id={idFor('session-mb')}
					label={copy.maxSessionBytes}
					min={1}
					value={Math.round(limits.maxSessionBytes / MEMORIES_BINARY_MB)}
					onChange={(value) =>
						set('maxSessionBytes', Math.round(value) * MEMORIES_BINARY_MB)
					}
				/>
			</div>
		</details>
	);
}

interface CommitmentProps {
	id: string;
	projectedBytes: number;
	acknowledged: boolean;
	onAcknowledge: (value: boolean) => void;
}

/** Account-wide storage the save would commit, with an explicit opt-in past the free tier. */
function CommitmentNotice({ id, projectedBytes, acknowledged, onAcknowledge }: CommitmentProps) {
	const limit = CLOUDFLARE_FREE_TIER.r2StorageBytes;
	const over = projectedBytes > limit;
	return (
		<div
			className={`memories-form__commitment${over ? ' memories-form__commitment--over' : ''}`}
		>
			<p>
				{copy.commitment(
					formatMemoriesStorage(projectedBytes),
					formatMemoriesStorage(limit),
				)}
				{over ? ` ${copy.commitmentOver}` : null}
			</p>
			{over ? (
				<label htmlFor={id}>
					<input
						id={id}
						type="checkbox"
						checked={acknowledged}
						onChange={(event) => onAcknowledge(event.target.checked)}
					/>
					{copy.commitmentAcknowledge}
				</label>
			) : null}
		</div>
	);
}

function parseExpectedGuests(raw: string): number | null {
	const value = Math.trunc(Number(raw));
	if (raw === '' || !(value >= 1)) return null;
	return Math.min(value, MEMORIES_EXPECTED_GUESTS_MAX);
}

interface PlanProps {
	form: MemorySpaceFormState;
	projectedBytes: number;
	acknowledged: boolean;
	idFor: IdFor;
	onChange: Change;
	onAcknowledge: (value: boolean) => void;
}

export function MemoryPlanFieldset({
	form,
	projectedBytes,
	acknowledged,
	idFor,
	onChange,
	onAcknowledge,
}: PlanProps) {
	const profile = matchMemoriesLimitProfile(form.limits);
	const profileKeys = Object.keys(MEMORIES_LIMIT_PROFILES) as MemoriesLimitProfile[];

	return (
		<fieldset>
			<legend>{copy.planSection}</legend>
			<div className="dashboard-form-grid">
				<div className="dashboard-form-field">
					<label htmlFor={idFor('entitlement')}>{copy.entitlement}</label>
					<select
						id={idFor('entitlement')}
						value={form.entitlement}
						onChange={(event) =>
							onChange({ entitlement: event.target.value as MemoriesEntitlement })
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
					<label htmlFor={idFor('profile')}>{copy.profile}</label>
					<select
						id={idFor('profile')}
						value={profile}
						onChange={(event) => {
							const next = event.target.value as MemoriesLimitProfile;
							if (profileKeys.includes(next)) {
								onChange({ limits: { ...MEMORIES_LIMIT_PROFILES[next] } });
							}
						}}
					>
						{profileKeys.map((key) => (
							<option key={key} value={key}>
								{PROFILE_LABEL[key]}
							</option>
						))}
						<option value="custom" disabled={profile !== 'custom'}>
							{copy.profileCustom}
						</option>
					</select>
				</div>
				<div className="dashboard-form-field">
					<label htmlFor={idFor('guests')}>{copy.expectedGuests}</label>
					<input
						id={idFor('guests')}
						type="number"
						min={1}
						max={MEMORIES_EXPECTED_GUESTS_MAX}
						step={1}
						value={form.expectedGuests ?? ''}
						onChange={(event) =>
							onChange({ expectedGuests: parseExpectedGuests(event.target.value) })
						}
					/>
					<small className="dashboard-form-help">{copy.expectedGuestsHelp}</small>
				</div>
			</div>
			<p className="dashboard-form-help">
				{copy.limitsSummary({
					eventStorage: formatMemoriesStorage(form.limits.maxEventBytes),
					eventObjects: form.limits.maxEventObjects,
					sessionFiles: form.limits.maxSessionFiles,
					sessionVideos: form.limits.maxSessionVideos,
					sessionStorage: formatMemoriesStorage(form.limits.maxSessionBytes),
				})}{' '}
				{copy.fileLimits(
					megabytes(MEMORIES_MAX_IMAGE_BYTES),
					MEMORIES_MAX_VIDEO_DURATION_SECONDS,
					megabytes(MEMORIES_MAX_VIDEO_BYTES),
				)}
			</p>
			<MemoriesCapacityExamples limits={form.limits} expectedGuests={form.expectedGuests} />
			<CommitmentNotice
				id={idFor('acknowledge')}
				projectedBytes={projectedBytes}
				acknowledged={acknowledged}
				onAcknowledge={onAcknowledge}
			/>
			<CustomLimits
				limits={form.limits}
				open={profile === 'custom'}
				idFor={idFor}
				onChange={(limits) => onChange({ limits })}
			/>
		</fieldset>
	);
}

interface NoteProps {
	form: MemorySpaceFormState;
	idFor: IdFor;
	onChange: Change;
}

export function MemoryNoteFieldset({ form, idFor, onChange }: NoteProps) {
	return (
		<fieldset>
			<legend>{copy.noteSection}</legend>
			<div className="dashboard-form-field">
				<label htmlFor={idFor('note')}>{copy.note}</label>
				<textarea
					id={idFor('note')}
					rows={3}
					maxLength={MEMORIES_ADMIN_NOTE_MAX_LENGTH}
					value={form.adminNote}
					onChange={(event) => onChange({ adminNote: event.target.value })}
				/>
				<small className="dashboard-form-help">
					{copy.noteHelp}{' '}
					{copy.noteCounter(form.adminNote.length, MEMORIES_ADMIN_NOTE_MAX_LENGTH)}
				</small>
			</div>
		</fieldset>
	);
}
