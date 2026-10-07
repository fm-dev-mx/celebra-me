import type {
	PlatformMetric,
	PlatformMissingVar,
	PlatformProviderId,
	PlatformProviderUsage,
} from '@/lib/platform/contract/types';
import {
	platformMeterStep,
	platformUsageLevel,
	platformUsageRatio,
} from '@/lib/platform/contract/meters';
import {
	formatPlatformMoney,
	platformCopy,
	platformMetricFormat,
	platformMetricLabel,
	platformMissingInfo,
	platformMissingLinkLabel,
	platformMissingStateLabel,
	platformProjectionLabel,
	platformProviderCostNote,
	platformProviderLink,
	platformProviderTitle,
	platformScopeLabel,
	platformWindowLabel,
} from '@/lib/platform/dashboard-copy';

function MissingList({ missing }: { missing: PlatformMissingVar[] }) {
	if (missing.length === 0) return null;
	return (
		<ul className="platform-card__missing">
			{missing.map((entry) => {
				const info = platformMissingInfo(entry.name);
				return (
					<li key={`${entry.name}:${entry.state}`}>
						<p className="platform-card__missing-head">
							<strong>{platformMissingStateLabel[entry.state]}:</strong>{' '}
							<code className="platform-card__missing-name">{entry.name}</code>
						</p>
						<p className="platform-card__meta">{info.description}</p>
						{info.setupUrl ? (
							<a
								className="platform-card__link"
								href={info.setupUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								{platformMissingLinkLabel}
							</a>
						) : null}
					</li>
				);
			})}
		</ul>
	);
}

function MetricRow({ metric }: { metric: PlatformMetric }) {
	const label = platformMetricLabel(metric);
	const format = platformMetricFormat(metric);
	const { used, limit } = metric.meter;
	const projection = platformProjectionLabel(metric.projection);
	const meta = `${platformScopeLabel[metric.scope]} · ${platformWindowLabel[metric.window]}`;
	return (
		<li className="platform-card__metric">
			{limit === null ? (
				<div className="usage-meter__label">
					<span>{label}</span>
					<strong>
						{used === null ? platformCopy.noData : format(used)}
						<span className="usage-meter__limit"> · {platformCopy.noQuota}</span>
					</strong>
				</div>
			) : (
				<MeterBar label={label} used={used} limit={limit} format={format} />
			)}
			<p className="platform-card__meta">{meta}</p>
			{projection ? <p className="platform-card__meta">{projection}</p> : null}
			{metric.overageUsd !== null ? (
				<p className="platform-card__meta" role="alert">
					{platformCopy.overage(formatPlatformMoney(metric.overageUsd))}
				</p>
			) : null}
		</li>
	);
}

function MeterBar({
	label,
	used,
	limit,
	format,
}: {
	label: string;
	used: number | null;
	limit: number;
	format: (value: number) => string;
}) {
	const ratio = used === null ? 0 : platformUsageRatio(used, limit);
	const level = used === null ? 'normal' : platformUsageLevel(ratio);
	const percent = Math.min(100, Math.round(ratio * 100));
	return (
		<div className={`usage-meter usage-meter--${level}`}>
			<div className="usage-meter__label">
				<span>{label}</span>
				<strong>
					{used === null ? platformCopy.noData : format(used)}
					<span className="usage-meter__limit"> / {format(limit)}</span>
				</strong>
			</div>
			<div
				className="usage-meter__track"
				role="meter"
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={used === null ? 0 : percent}
				aria-valuetext={used === null ? platformCopy.noData : undefined}
			>
				<span data-fill={platformMeterStep(percent)} />
			</div>
		</div>
	);
}

interface Props {
	provider: PlatformProviderId;
	usage: PlatformProviderUsage;
}

export default function ProviderUsageCard({ provider, usage }: Props) {
	const title = platformProviderTitle[provider];
	const missing = usage.kind === 'unavailable' ? [] : usage.missing;
	const cost =
		usage.kind === 'ok' && usage.spendUsd !== null
			? platformCopy.spend(formatPlatformMoney(usage.spendUsd))
			: platformProviderCostNote[provider];
	return (
		<section className="dashboard-card platform-card" aria-label={title}>
			<header className="platform-card__header">
				<h3>{title}</h3>
				{usage.kind === 'ok' ? (
					<span className="platform-card__stamp">
						{platformCopy.approx(usage.fetchedAt)}
					</span>
				) : null}
			</header>
			{usage.kind === 'unconfigured' ? (
				<p className="platform-card__notice">{platformCopy.unconfigured}</p>
			) : null}
			{usage.kind === 'unavailable' ? (
				<p className="platform-card__notice">{platformCopy.unavailable}</p>
			) : null}
			<MissingList missing={missing} />
			{usage.kind === 'ok' ? (
				<ul className="platform-card__metrics">
					{usage.metrics.map((metric, index) => (
						<MetricRow
							key={`${metric.id}:${metric.resource ?? index}`}
							metric={metric}
						/>
					))}
				</ul>
			) : null}
			<p className="platform-card__cost">{cost}</p>
			<a
				className="platform-card__link"
				href={platformProviderLink[provider]}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={`${platformCopy.link}: ${title}`}
			>
				{platformCopy.link}
			</a>
		</section>
	);
}
