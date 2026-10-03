import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import ProviderUsageCard from '@/components/dashboard/platform/ProviderUsageCard';
import { platformAdminApi } from '@/lib/platform/client/api';
import { platformCopy, platformSectionTitle } from '@/lib/platform/dashboard-copy';
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

	return (
		<section className="platform-usage" aria-label={platformCopy.title}>
			<p className="platform-usage__intro">{platformCopy.intro}</p>
			{error ? (
				<p className="dashboard-error" role="alert">
					{platformCopy.loadError}
				</p>
			) : null}
			{!report && !error ? <p className="dashboard-status">{platformCopy.loading}</p> : null}
			{report
				? report.map((section) => (
						<section key={section.id} className="platform-usage__section">
							<h2 className="platform-usage__section-title">
								{platformSectionTitle[section.id]}
							</h2>
							<div className="platform-usage__grid">
								{section.cards.map((card) => (
									<ProviderUsageCard
										key={`${section.id}:${card.provider}`}
										provider={card.provider}
										usage={card.usage}
									/>
								))}
							</div>
						</section>
					))
				: null}
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
