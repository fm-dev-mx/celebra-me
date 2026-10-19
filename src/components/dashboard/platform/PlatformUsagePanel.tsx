import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import PlatformStatusSummary from '@/components/dashboard/platform/PlatformStatusSummary';
import ProviderSection from '@/components/dashboard/platform/ProviderSection';
import { platformAdminApi } from '@/lib/platform/client/api';
import { platformCopy } from '@/lib/platform/dashboard-copy';
import {
	groupPlatformReport,
	platformDeployment,
	summarizePlatformReport,
} from '@/lib/platform/report-view';
import type { PlatformUsageReport } from '@/lib/platform/contract/types';

function PlatformUsagePanel() {
	const [report, setReport] = useState<PlatformUsageReport | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const usage = await platformAdminApi.usage();
				if (!cancelled) setReport(usage);
			} catch {
				if (!cancelled) setError(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const deployment = report ? platformDeployment(report) : 'local';

	return (
		<div className="platform-usage" aria-busy={!report && !error}>
			<p className="platform-usage__intro">{platformCopy.intro}</p>
			{error ? (
				<p className="dashboard-error" role="alert">
					{platformCopy.loadError}
				</p>
			) : null}
			{!report && !error ? (
				<p className="dashboard-status dashboard-status--loading" role="status">
					{platformCopy.loading}
				</p>
			) : null}
			{report ? (
				<>
					<PlatformStatusSummary
						summary={summarizePlatformReport(report)}
						now={new Date()}
					/>
					{groupPlatformReport(report).map((view) => (
						<ProviderSection key={view.provider} view={view} deployment={deployment} />
					))}
				</>
			) : null}
			<p className="platform-usage__hint">{platformCopy.committedHint}</p>
		</div>
	);
}

export default function PlatformUsagePanelWithErrorBoundary() {
	return (
		<ErrorBoundary>
			<PlatformUsagePanel />
		</ErrorBoundary>
	);
}
