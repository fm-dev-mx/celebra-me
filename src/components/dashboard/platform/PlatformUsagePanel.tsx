import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import ProviderUsageCard from '@/components/dashboard/platform/ProviderUsageCard';
import { platformAdminApi } from '@/lib/platform/client/api';
import { platformCopy } from '@/lib/platform/dashboard-copy';
import { PLATFORM_PROVIDER_IDS, type PlatformUsageReport } from '@/lib/platform/contract/types';

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

	return (
		<section className="platform-usage" aria-label={platformCopy.title}>
			<p className="platform-usage__intro">{platformCopy.intro}</p>
			{error ? (
				<p className="dashboard-error" role="alert">
					{platformCopy.loadError}
				</p>
			) : null}
			{!report && !error ? <p className="dashboard-status">{platformCopy.loading}</p> : null}
			<div className="platform-usage__grid">
				{report
					? PLATFORM_PROVIDER_IDS.map((provider) => (
							<ProviderUsageCard
								key={provider}
								provider={provider}
								usage={report[provider]}
							/>
						))
					: null}
			</div>
			<p className="platform-usage__hint">{platformCopy.committedHint}</p>
		</section>
	);
}

export default function PlatformUsagePanelWithErrorBoundary() {
	return (
		<ErrorBoundary>
			<PlatformUsagePanel />
		</ErrorBoundary>
	);
}
