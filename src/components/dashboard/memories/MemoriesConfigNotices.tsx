import type { MemoriesReadiness } from '@/lib/memories/contract/catalog';
import {
	describeMemoriesConfigGap,
	describeMemoriesWorkerUnreachable,
	type MemoriesLoadErrorGuide,
} from '@/lib/memories/dashboard-copy';

interface Props {
	readiness: MemoriesReadiness | null | undefined;
}

/** Super-admin notices for missing memories settings: what stops working and how to fix it. */
export default function MemoriesConfigNotices({ readiness }: Props) {
	if (!readiness) return null;
	const guides: Array<{ key: string; guide: MemoriesLoadErrorGuide }> = [
		...readiness.missing.map((key) => ({ key, guide: describeMemoriesConfigGap(key) })),
		...readiness.unreachable.map((key) => ({
			key: `${key}-unreachable`,
			guide: describeMemoriesWorkerUnreachable(key),
		})),
	];
	if (guides.length === 0) return null;
	return (
		<section
			className="memories-config-notices"
			aria-label="Configuración pendiente de Recuerdos"
		>
			{guides.map(({ key, guide }) => (
				<div
					key={key}
					className="memories-notice memories-notice--warning memories-config-notice"
					role="status"
				>
					<p className="memories-config-notice__title">{guide.title}</p>
					<ol className="memories-config-notice__steps">
						{guide.steps.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>
				</div>
			))}
		</section>
	);
}
