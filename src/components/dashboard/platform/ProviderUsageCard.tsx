import type { ReactNode } from 'react';
import type {
	PlatformMetric,
	PlatformMissingVar,
	PlatformProviderUsage,
} from '@/lib/platform/contract/types';
import {
	platformMeterStep,
	platformUsageLevel,
	platformUsageRatio,
} from '@/lib/platform/contract/meters';
import {
	formatPlatformMoney,
	formatPlatformPercent,
	platformCopy,
	platformLevelLabel,
	platformMetricEmpty,
	platformMetricFormat,
	platformMetricLabel,
	platformMetricNote,
	platformMissingDestination,
	platformMissingInfo,
	platformMissingLinkLabel,
	platformMissingStateLabel,
	platformProjectionLabel,
	platformWindowLabel,
	type PlatformDeployment,
} from '@/lib/platform/dashboard-copy';

function MissingNotice({
	entry,
	deployment,
}: {
	entry: PlatformMissingVar;
	deployment: PlatformDeployment;
}) {
	const info = platformMissingInfo(entry.name);
	const destination = platformMissingDestination(deployment);
	return (
		<li className="platform-notice platform-notice--warning">
			<p className="platform-notice__title">
				{platformMissingStateLabel[entry.state]}:{' '}
				<code className="platform-notice__name">{entry.name}</code>
			</p>
			<p>{info.description}</p>
			<p>{destination.text}</p>
			{destination.command ? (
				<code className="platform-notice__command">{destination.command}</code>
			) : null}
			{info.setupUrl ? (
				<a
					className="platform-link"
					href={info.setupUrl}
					target="_blank"
					rel="noopener noreferrer"
				>
					{info.linkLabel ?? platformMissingLinkLabel}
					<span className="sr-only"> (se abre en otra pestaña)</span>
				</a>
			) : null}
		</li>
	);
}

function MeterTrack({
	label,
	percent,
	valueText,
}: {
	label: string;
	percent: number;
	valueText: string;
}) {
	return (
		<div
			className="usage-meter__track"
			role="meter"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
			aria-valuetext={valueText}
		>
			<span data-fill={platformMeterStep(percent)} />
		</div>
	);
}

function MetricRow({ metric, pending }: { metric: PlatformMetric; pending: boolean }) {
	const label = platformMetricLabel(metric);
	const format = platformMetricFormat(metric);
	const { used, limit } = metric.meter;
	const ratio = used !== null && limit !== null ? platformUsageRatio(used, limit) : null;
	const level = ratio === null ? 'normal' : platformUsageLevel(ratio);
	const badge = platformLevelLabel[level];
	const percent = ratio === null ? 0 : Math.min(100, Math.round(ratio * 100));
	const projection = platformProjectionLabel(metric.projection);
	const note = platformMetricNote(metric);
	const meta = [platformWindowLabel[metric.window], projection].filter(Boolean).join(' · ');

	let value: ReactNode;
	if (used === null) {
		value = (
			<span className="platform-metric__empty">
				{pending
					? platformCopy.pendingConfig
					: (platformMetricEmpty(metric) ?? platformCopy.noData)}
			</span>
		);
	} else {
		value = (
			<>
				<strong>{format(used)}</strong>
				{limit !== null ? (
					<span className="platform-metric__limit">
						{` ${platformCopy.ofLimit(format(limit))}`}
					</span>
				) : note ? null : (
					<span className="platform-metric__limit">{` · ${platformCopy.noQuota}`}</span>
				)}
				{ratio !== null ? (
					<span className="platform-metric__percent">{formatPlatformPercent(ratio)}</span>
				) : null}
			</>
		);
	}

	return (
		<li className={`platform-metric usage-meter usage-meter--${level}`}>
			<div className="platform-metric__head">
				<span className="platform-metric__label">{label}</span>
				{badge ? (
					<span className={`platform-badge platform-badge--${level}`}>{badge}</span>
				) : null}
			</div>
			<p className="platform-metric__value">{value}</p>
			{used !== null && limit !== null && ratio !== null ? (
				<MeterTrack
					label={label}
					percent={percent}
					valueText={`${format(used)} ${platformCopy.ofLimit(format(limit))} (${formatPlatformPercent(ratio)})`}
				/>
			) : null}
			{used !== null ? <p className="platform-metric__meta">{meta}</p> : null}
			{note ? <p className="platform-metric__meta">{note}</p> : null}
			{metric.overageUsd !== null ? (
				<p className="platform-metric__overage" role="alert">
					{platformCopy.overage(formatPlatformMoney(metric.overageUsd))}
				</p>
			) : null}
		</li>
	);
}

interface Props {
	/** Visible block title («Producción»); `label` names the provider too. */
	title: string;
	label: string;
	hint?: string;
	headingLevel: 3 | 4;
	usage: PlatformProviderUsage;
	deployment: PlatformDeployment;
}

/** One block of quotas: the shared account/project, or one environment. */
export default function ProviderUsageCard({
	title,
	label,
	hint,
	headingLevel,
	usage,
	deployment,
}: Props) {
	const missing = usage.kind === 'unavailable' ? [] : usage.missing;
	const Heading = headingLevel === 3 ? 'h3' : 'h4';
	return (
		<section className="dashboard-card platform-card" aria-label={label}>
			<header className="platform-card__header">
				<Heading className="platform-card__title">{title}</Heading>
				{hint ? <p className="platform-card__hint">{hint}</p> : null}
			</header>
			{usage.kind === 'unconfigured' ? (
				<p className="platform-card__status">{platformCopy.unconfigured}</p>
			) : null}
			{usage.kind === 'unavailable' ? (
				<p className="platform-notice platform-notice--danger">
					{platformCopy.unavailable}
				</p>
			) : null}
			{missing.length > 0 ? (
				<ul className="platform-card__notices">
					{missing.map((entry) => (
						<MissingNotice
							key={`${entry.name}:${entry.state}`}
							entry={entry}
							deployment={deployment}
						/>
					))}
				</ul>
			) : null}
			{usage.kind === 'ok' && usage.metrics.length > 0 ? (
				<ul className="platform-card__metrics">
					{usage.metrics.map((metric, index) => (
						<MetricRow
							key={`${metric.id}:${metric.resource ?? index}`}
							metric={metric}
							pending={missing.length > 0}
						/>
					))}
				</ul>
			) : null}
			{usage.kind === 'ok' && usage.spendUsd !== null ? (
				<p className="platform-card__spend">
					{platformCopy.spend(formatPlatformMoney(usage.spendUsd))}
				</p>
			) : null}
		</section>
	);
}
