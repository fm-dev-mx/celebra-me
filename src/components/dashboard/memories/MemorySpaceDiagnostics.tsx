import { useState } from 'react';
import {
	MEMORIES_MEDIA_STATUSES,
	MEMORIES_UPLOAD_FAILURE_REASONS,
	type MemoriesSpaceDiagnostics,
} from '@/lib/memories/contract/catalog';
import { memoriesAdminApi } from '@/lib/memories/client/api';
import { formatMemoriesDateTime } from '@/lib/memories/copy';
import {
	MEMORIES_FAILURE_LABEL,
	MEMORIES_LIVE_CHECK_STATUS,
	MEMORIES_STATUS_LABEL,
	describeMemoriesLiveCheck,
	memoriesDiagnosticsCopy as copy,
} from '@/lib/memories/dashboard-copy';

interface Props {
	eventId: string;
	eventTitle: string;
	timeZone: string;
}

/** Super-admin health view of one space; it loads only when opened. */
export default function MemorySpaceDiagnostics({ eventId, eventTitle, timeZone }: Props) {
	const [data, setData] = useState<MemoriesSpaceDiagnostics | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const load = async (live: boolean) => {
		setLoading(true);
		setError(false);
		try {
			setData(await memoriesAdminApi.diagnostics(eventId, live));
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	};

	const failures = data
		? MEMORIES_UPLOAD_FAILURE_REASONS.filter((reason) => (data.failures[reason] ?? 0) > 0)
		: [];
	const stalled = data ? data.stalled.uploading + data.stalled.validating : 0;

	return (
		<details
			className="memories-diagnostics"
			onToggle={(event) => {
				if (event.currentTarget.open && !data && !loading) void load(false);
			}}
		>
			<summary aria-label={`${copy.summary}: ${eventTitle}`}>{copy.summary}</summary>
			{loading && !data ? <p className="dashboard-status">{copy.loading}</p> : null}
			{error ? (
				<p className="dashboard-error" role="alert">
					{copy.loadError}{' '}
					<button
						type="button"
						className="btn-secondary btn--compact"
						onClick={() => void load(false)}
					>
						{copy.retry}
					</button>
				</p>
			) : null}
			{data ? (
				<div className="memories-diagnostics__body">
					<section aria-label={copy.statusTitle}>
						<h4>{copy.statusTitle}</h4>
						<dl className="memories-diagnostics__grid">
							{MEMORIES_MEDIA_STATUSES.map((status) => (
								<div key={status}>
									<dt>{MEMORIES_STATUS_LABEL[status]}</dt>
									<dd>{data.statusCounts[status].toLocaleString('es-MX')}</dd>
								</div>
							))}
						</dl>
						<p className="memories-diagnostics__line">
							{data.lastAcceptedAt
								? copy.lastAccepted(
										formatMemoriesDateTime(data.lastAcceptedAt, timeZone),
									)
								: copy.noAccepted}
						</p>
					</section>

					<section aria-label={copy.stalledTitle}>
						<h4>{copy.stalledTitle}</h4>
						<p
							className={`memories-diagnostics__line${stalled > 0 ? ' memories-diagnostics__line--warning' : ''}`}
							role={stalled > 0 ? 'alert' : undefined}
						>
							{stalled > 0
								? copy.stalled(data.stalled.uploading, data.stalled.validating)
								: copy.noStalled}
						</p>
					</section>

					<section aria-label={copy.failuresTitle}>
						<h4>{copy.failuresTitle}</h4>
						{failures.length === 0 &&
						data.failuresWithoutReason === 0 &&
						data.abandoned === 0 ? (
							<p className="memories-diagnostics__line">{copy.noFailures}</p>
						) : (
							<ul className="memories-diagnostics__list">
								{failures.map((reason) => (
									<li key={reason}>
										<span>{MEMORIES_FAILURE_LABEL[reason]}</span>
										<strong>
											{(data.failures[reason] ?? 0).toLocaleString('es-MX')}
										</strong>
									</li>
								))}
								{data.failuresWithoutReason > 0 ? (
									<li>
										<span>
											{copy.withoutReason(data.failuresWithoutReason)}
										</span>
									</li>
								) : null}
								{data.abandoned > 0 ? (
									<li>
										<span>{copy.abandoned(data.abandoned)}</span>
									</li>
								) : null}
							</ul>
						)}
						{data.auditTruncated ? (
							<p className="memories-diagnostics__line">{copy.truncated}</p>
						) : null}
					</section>

					<section aria-label={copy.liveTitle}>
						<h4>{copy.liveTitle}</h4>
						<p className="memories-diagnostics__line">{copy.liveHint}</p>
						{data.liveChecks ? (
							<ul className="memories-diagnostics__list">
								{data.liveChecks.map((check) => (
									<li
										key={check.check}
										className={`memories-diagnostics__check memories-diagnostics__check--${check.status.toLowerCase()}`}
									>
										<span>{describeMemoriesLiveCheck(check)}</span>
										<strong>{MEMORIES_LIVE_CHECK_STATUS[check.status]}</strong>
										<small>{check.detail}</small>
									</li>
								))}
							</ul>
						) : null}
						<button
							type="button"
							className="btn-secondary btn--compact"
							disabled={loading}
							onClick={() => void load(true)}
						>
							{loading ? copy.runningLive : copy.runLive}
						</button>
					</section>

					<p className="memories-diagnostics__line memories-diagnostics__meta">
						{copy.generatedAt(formatMemoriesDateTime(data.generatedAt, timeZone))}
					</p>
				</div>
			) : null}
		</details>
	);
}
