import {
	formatPlatformAge,
	formatPlatformTime,
	platformCopy,
	platformSummaryCopy,
} from '@/lib/platform/dashboard-copy';
import type { PlatformSummary } from '@/lib/platform/report-view';

const ICON: Record<PlatformSummary['level'], string> = {
	ok: '✓',
	attention: 'i',
	warning: '!',
	critical: '!',
};

interface Props {
	summary: PlatformSummary;
	now: Date;
}

export default function PlatformStatusSummary({ summary, now }: Props) {
	const chips: { key: string; tone: string; text: string }[] = [];
	if (summary.critical > 0) {
		chips.push({
			key: 'critical',
			tone: 'critical',
			text: platformSummaryCopy.critical(summary.critical),
		});
	}
	if (summary.warning > 0) {
		chips.push({
			key: 'warning',
			tone: 'warning',
			text: platformSummaryCopy.warning(summary.warning),
		});
	}
	if (summary.healthy > 0) {
		chips.push({
			key: 'healthy',
			tone: 'ok',
			text: platformSummaryCopy.healthy(summary.healthy),
		});
	}
	if (summary.missing > 0) {
		chips.push({
			key: 'missing',
			tone: 'attention',
			text: platformSummaryCopy.missing(summary.missing),
		});
	}
	if (summary.unavailable > 0) {
		chips.push({
			key: 'unavailable',
			tone: 'critical',
			text: platformSummaryCopy.unavailable(summary.unavailable),
		});
	}

	return (
		<section
			className={`platform-summary platform-summary--${summary.level}`}
			aria-labelledby="platform-summary-title"
		>
			<span className="platform-summary__icon" aria-hidden="true">
				{ICON[summary.level]}
			</span>
			<div className="platform-summary__body">
				<p className="platform-summary__eyebrow">{platformSummaryCopy.heading}</p>
				<h2 id="platform-summary-title" className="platform-summary__title">
					{platformSummaryCopy.title[summary.level]}
				</h2>
				<p className="platform-summary__detail">
					{platformSummaryCopy.detail[summary.level]}
				</p>
				{chips.length > 0 ? (
					<ul className="platform-summary__chips">
						{chips.map((chip) => (
							<li
								key={chip.key}
								className={`platform-chip platform-chip--${chip.tone}`}
							>
								{chip.text}
							</li>
						))}
					</ul>
				) : null}
				<p className="platform-summary__stamp">
					{summary.updatedAt ? (
						<time dateTime={summary.updatedAt}>
							{platformCopy.updated(
								formatPlatformAge(summary.updatedAt, now),
								formatPlatformTime(summary.updatedAt),
							)}
						</time>
					) : (
						platformCopy.notUpdated
					)}
				</p>
			</div>
		</section>
	);
}
