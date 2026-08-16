import {
	EVIDENCE_LABELS,
	PUBLICATION_ACTION_LABELS,
	PUBLICATION_REASON_LABELS,
} from '@/lib/status/labels';
import { formatTransitionLabel } from '@/lib/status/presentation';
import { publicationRemediation } from '@/lib/status/semantics';
import { partitionPromotions } from '@/lib/status/action-plan';
import { StatusSemanticBadge } from '@/components/dashboard/status/StatusSemanticBadge';
import type { CanonicalStatusView } from '@/lib/status/types';

export function PublicationDetails({ view }: { view: CanonicalStatusView }) {
	const { release: queue, authoring } = partitionPromotions(view.promotions);
	return (
		<details className="canonical-status__details canonical-status__secondary">
			<summary id="publication-title">
				Publicación · registro {view.registryCount} · en sync {view.inSyncCount} · atención{' '}
				{queue.length}
				{authoring.length > 0 ? ` · authoring ${authoring.length}` : ''}
			</summary>
			<p>
				Evidencia de estados por invitación. Las acciones de release viven una sola vez en
				la cola superior. Las definiciones in_progress no son deuda de publicación.
			</p>
			{queue.length > 0 ? (
				<div className="canonical-status__queue">
					{queue.map((row) => {
						const remediation = publicationRemediation(row);
						return (
							<article
								className={`canonical-status__card canonical-status__card--${remediation.semantic}`}
								key={row.slug}
							>
								<header className="canonical-status__card-head">
									<h3>
										{row.title}{' '}
										<span className="canonical-status__slug">({row.slug})</span>
									</h3>
									<StatusSemanticBadge semantic={remediation.semantic} />
								</header>
								<p className="canonical-status__reason">
									{PUBLICATION_REASON_LABELS[row.reasonCode]}
								</p>
								<p>
									{formatTransitionLabel(row.source, row.destination)} ·{' '}
									{PUBLICATION_ACTION_LABELS[row.action]} · Evidencia:{' '}
									<strong>{EVIDENCE_LABELS[row.evidence]}</strong>
								</p>
								{row.preflightBlockCode ? (
									<p className="canonical-status__reason">
										Preflight: {row.preflightBlockCode}
										{row.preflightReason ? ` — ${row.preflightReason}` : ''}
									</p>
								) : null}
								{row.uncertaintyNotes.length > 0 ? (
									<p className="canonical-status__unverified">
										{row.uncertaintyNotes.join(' · ')}
									</p>
								) : null}
								<details className="canonical-status__details">
									<summary>Detalle técnico</summary>
									<dl>
										<dt>reasonCode</dt>
										<dd>{row.reasonCode}</dd>
										<dt>Estados</dt>
										<dd>
											Local {row.environments.local} · Preview{' '}
											{row.environments.preview} · Producción{' '}
											{row.environments.production}
										</dd>
									</dl>
								</details>
							</article>
						);
					})}
				</div>
			) : (
				<p className="canonical-status__empty-success">
					✓ No hay invitaciones publicadas que requieran promoción.
				</p>
			)}
			{authoring.length > 0 ? (
				<details className="canonical-status__details">
					<summary>Authoring in_progress ({authoring.length})</summary>
					<p>
						No son obligación de release. No ejecute invitation:release ni prod:apply.
					</p>
					<ul>
						{authoring.map((row) => (
							<li key={row.slug}>
								{row.title} ({row.slug}) · {row.action}
							</li>
						))}
					</ul>
				</details>
			) : null}
			{view.inSyncCount > 0 ? (
				<details className="canonical-status__details">
					<summary>Invitaciones en sync ({view.inSyncCount})</summary>
					<ul>
						{view.inSyncSlugs.map((slug) => (
							<li key={slug}>{slug}</li>
						))}
					</ul>
				</details>
			) : null}
		</details>
	);
}
