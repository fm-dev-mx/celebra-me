import type {
	MemoriesAdminTotals,
	MemoriesPlatformMeter,
	MemoriesPlatformUsage as PlatformUsage,
} from '@/lib/memories/contract/catalog';
import { CLOUDFLARE_FREE_TIER } from '@/lib/memories/contract/limits';
import {
	formatMemoriesCount,
	formatMemoriesStorage,
	memoriesAdminCopy as copy,
	memoriesMeterStep,
	memoriesUsageLevel,
	memoriesUsageRatio,
} from '@/lib/memories/dashboard-copy';

interface MeterProps {
	label: string;
	meter: MemoriesPlatformMeter;
	format: (value: number) => string;
}

function Meter({ label, meter, format }: MeterProps) {
	const ratio = meter.used === null ? 0 : memoriesUsageRatio(meter.used, meter.limit);
	const level = meter.used === null ? 'normal' : memoriesUsageLevel(ratio);
	const percent = Math.min(100, Math.round(ratio * 100));
	return (
		<div className={`memories-meter memories-meter--${level}`}>
			<div className="memories-meter__label">
				<span>{label}</span>
				<strong>
					{meter.used === null ? copy.noData : format(meter.used)}
					<span className="memories-meter__limit"> / {format(meter.limit)}</span>
				</strong>
			</div>
			<div
				className="memories-meter__track"
				role="meter"
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={meter.used === null ? undefined : percent}
			>
				<span data-fill={memoriesMeterStep(percent)} />
			</div>
		</div>
	);
}

interface Props {
	usage: PlatformUsage | null;
	totals: MemoriesAdminTotals;
}

function formatTime(iso: string): string {
	return new Intl.DateTimeFormat('es-MX', { timeStyle: 'short' }).format(new Date(iso));
}

export default function MemoriesPlatformUsage({ usage, totals }: Props) {
	const storageLimit = CLOUDFLARE_FREE_TIER.r2StorageBytes;
	const committedOver = totals.committedBytes > storageLimit;
	const live = usage?.kind === 'ok' ? usage : null;

	return (
		<section className="dashboard-card memories-platform" aria-label={copy.platformTitle}>
			<div className="memories-platform__header">
				<h2>{copy.platformTitle}</h2>
				{live ? (
					<span className="memories-platform__stamp">
						{copy.platformApprox(formatTime(live.fetchedAt))}
					</span>
				) : null}
			</div>

			{usage === null ? <p className="dashboard-status">{copy.platformLoading}</p> : null}
			{usage && usage.kind !== 'ok' ? (
				<p className="memories-platform__notice">
					{usage.kind === 'unconfigured'
						? copy.platformUnconfigured
						: copy.platformUnavailable}
				</p>
			) : null}

			<div className="memories-platform__grid">
				{live ? (
					<>
						<Meter
							label={copy.storage}
							meter={live.r2StorageBytes}
							format={formatMemoriesStorage}
						/>
						<Meter
							label={copy.classA}
							meter={live.r2ClassAOperations}
							format={formatMemoriesCount}
						/>
						<Meter
							label={copy.classB}
							meter={live.r2ClassBOperations}
							format={formatMemoriesCount}
						/>
						<Meter
							label={copy.workers}
							meter={live.workersRequests}
							format={formatMemoriesCount}
						/>
						<Meter
							label={copy.durableObjects}
							meter={live.durableObjectsRequests}
							format={formatMemoriesCount}
						/>
					</>
				) : (
					<Meter
						label={copy.storageEstimated}
						meter={{ used: totals.residentBytes, limit: storageLimit }}
						format={formatMemoriesStorage}
					/>
				)}
			</div>

			<p
				className={`memories-platform__committed${committedOver ? ' memories-platform__committed--over' : ''}`}
				role={committedOver ? 'alert' : undefined}
			>
				{copy.committed(
					formatMemoriesStorage(totals.committedBytes),
					formatMemoriesStorage(storageLimit),
				)}
				{committedOver ? ` ${copy.committedOver}` : null}
			</p>
		</section>
	);
}
