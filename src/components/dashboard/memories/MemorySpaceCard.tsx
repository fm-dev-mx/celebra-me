import {
	resolveMemoriesWindowState,
	type MemoriesAdminSpaceItem,
} from '@/lib/memories/contract/catalog';
import {
	buildMemoriesPublicPath,
	buildMemoriesPublicUrl,
} from '@/lib/memories/contract/private-request';
import { formatMemoriesDate, formatMemoriesDateTime } from '@/lib/memories/copy';
import {
	MEMORIES_ENTITLEMENT_LABEL,
	MEMORIES_WINDOW_BADGE,
	MEMORIES_WINDOW_LABEL,
	formatMemoriesStorage,
	memoriesAdminCopy as copy,
	memoriesMeterStep,
	memoriesUsageLevel,
	memoriesUsageRatio,
} from '@/lib/memories/dashboard-copy';
import { memoriesAdminApi } from '@/lib/memories/client/api';

interface Props {
	item: MemoriesAdminSpaceItem;
	now: Date;
	busy: boolean;
	onEdit: (item: MemoriesAdminSpaceItem) => void;
	onToggle: (item: MemoriesAdminSpaceItem) => void;
	onCopy: (url: string) => void;
}

export default function MemorySpaceCard({ item, now, busy, onEdit, onToggle, onCopy }: Props) {
	const state = resolveMemoriesWindowState(item, now);
	const publicUrl = buildMemoriesPublicUrl(item.publicSlug);
	const { usage } = item;
	const ratio = Math.max(
		memoriesUsageRatio(usage.residentBytes, item.maxEventBytes),
		memoriesUsageRatio(usage.residentObjects, item.maxEventObjects),
	);
	const percent = Math.min(100, Math.round(ratio * 100));
	const expired = state === 'expired';

	return (
		<article className="dashboard-card memories-space" aria-label={item.eventTitle}>
			<header className="memories-space__header">
				<div>
					<h3>{item.eventTitle}</h3>
					<p className="memories-space__dates">
						{copy.window(
							formatMemoriesDateTime(item.uploadStartsAt, item.timeZone),
							formatMemoriesDateTime(item.uploadEndsAt, item.timeZone),
						)}
						<br />
						{copy.retention(
							formatMemoriesDate(item.retentionEndsAt, item.timeZone),
						)} · {item.timeZone} · {MEMORIES_ENTITLEMENT_LABEL[item.entitlement]}
					</p>
				</div>
				<span className={`dashboard-badge ${MEMORIES_WINDOW_BADGE[state]}`}>
					{MEMORIES_WINDOW_LABEL[state]}
				</span>
			</header>

			<div className="memories-space__url">
				<code>{publicUrl}</code>
				<button
					type="button"
					className="btn-secondary"
					aria-label={`${copy.copyUrl}: ${item.eventTitle}`}
					onClick={() => onCopy(publicUrl)}
				>
					{copy.copyUrl}
				</button>
			</div>

			<dl className="memories-space__stats">
				<div>
					<dt>Fotos</dt>
					<dd>{usage.photos.toLocaleString('es-MX')}</dd>
				</div>
				<div>
					<dt>Videos</dt>
					<dd>{usage.videos.toLocaleString('es-MX')}</dd>
				</div>
				<div>
					<dt>Invitados</dt>
					<dd>
						{usage.guestsWithUploads.toLocaleString('es-MX')}
						<span className="memories-space__sub">
							{' '}
							de {usage.sessions.toLocaleString('es-MX')} registrados
						</span>
					</dd>
				</div>
				<div className="memories-space__capacity">
					<dt>Cupo usado</dt>
					<dd>
						{formatMemoriesStorage(usage.residentBytes)}
						<span className="memories-space__sub">
							{' '}
							de {formatMemoriesStorage(item.maxEventBytes)}
						</span>
						<span
							className={`memories-meter memories-meter__track memories-meter--${memoriesUsageLevel(ratio)}`}
							role="meter"
							aria-label="Cupo usado"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={percent}
						>
							<span data-fill={memoriesMeterStep(percent)} />
						</span>
					</dd>
				</div>
			</dl>

			<p className="memories-space__activity">
				{usage.lastAcceptedAt
					? copy.lastUpload(formatMemoriesDateTime(usage.lastAcceptedAt, item.timeZone))
					: copy.noUploads}
				{usage.inFlight > 0 ? ` · ${copy.inFlight(usage.inFlight)}` : null}
				{usage.rejected > 0 ? ` · ${copy.rejected(usage.rejected)}` : null}
			</p>

			<div className="memories-space__actions">
				<div>
					<a
						className="btn-primary"
						href={memoriesAdminApi.qrUrl(item.eventId)}
						download
						aria-label={`${copy.downloadQr}: ${item.eventTitle}`}
					>
						{copy.downloadQr}
					</a>
					<a
						className="btn-secondary"
						href={buildMemoriesPublicPath(item.publicSlug)}
						target="_blank"
						rel="noopener noreferrer"
					>
						{copy.openPage}
					</a>
				</div>
				{expired ? null : (
					<div>
						<button
							type="button"
							className="btn-secondary"
							disabled={busy}
							onClick={() => onEdit(item)}
						>
							{copy.edit}
						</button>
						<button
							type="button"
							className="btn-secondary"
							disabled={busy}
							onClick={() => onToggle(item)}
						>
							{item.enabled ? copy.pause : copy.resume}
						</button>
					</div>
				)}
			</div>
		</article>
	);
}
