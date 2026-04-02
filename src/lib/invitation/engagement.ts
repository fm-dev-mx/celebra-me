/**
 * Engagement Tracking for Invitation Sections
 */

interface EngagementConfig {
	inviteId: string;
	totalSections: number;
	throttleMs?: number;
}

export function initEngagementTracking(config: EngagementConfig) {
	if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

	const seenSections = new Set<string>();
	let lastReportedPercentage = 0;
	let timeout: number | null = null;

	const reportEngagement = async () => {
		const percentage = Math.round((seenSections.size / config.totalSections) * 100);

		if (percentage <= lastReportedPercentage) return;

		lastReportedPercentage = percentage;

		try {
			await fetch(`/api/invitacion/${config.inviteId}/view`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ viewPercentage: percentage }),
			});
		} catch (error) {
			console.error('[Engagement] Failed to report view:', error);
		}
	};

	const throttledReport = () => {
		if (timeout) return;
		timeout = window.setTimeout(() => {
			reportEngagement();
			timeout = null;
		}, config.throttleMs || 5000);
	};

	const observer = new IntersectionObserver(
		(entries) => {
			let changed = false;
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const sectionId = entry.target.getAttribute('data-section-id');
					if (sectionId && !seenSections.has(sectionId)) {
						seenSections.add(sectionId);
						changed = true;
					}
				}
			});

			if (changed) {
				throttledReport();
			}
		},
		{ threshold: 0.2 },
	);

	// Observe all elements with data-section-id
	document.querySelectorAll('[data-section-id]').forEach((el) => {
		observer.observe(el);
	});

	// Initial report for the first section
	setTimeout(reportEngagement, 1000);
}
