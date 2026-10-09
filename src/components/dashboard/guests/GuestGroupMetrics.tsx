import React, { useState } from 'react';
import { ChevronDownGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import GuestPassesBar from '@/components/dashboard/guests/GuestPassesBar';
import type { GroupMetric } from '@/components/dashboard/guests/guest-presenter';
import { useMediaQuery } from '@/hooks/use-media-query';

interface GuestGroupMetricsProps {
	metrics: GroupMetric[];
	activeGroup: string;
	onSelectGroup: (group: string) => void;
}

/**
 * People per group (confirmed of assigned passes). Collapsed on phones, open where
 * there is room; tapping a group filters the list like the chips do.
 */
const GuestGroupMetrics: React.FC<GuestGroupMetricsProps> = ({
	metrics,
	activeGroup,
	onSelectGroup,
}) => {
	const roomy = useMediaQuery('(min-width: 768px)') === true;
	const [toggled, setToggled] = useState<boolean | null>(null);
	const open = toggled ?? roomy;
	// Only "Sin grupo" means groups are not in use yet; nothing to compare.
	if (metrics.length === 0 || (metrics.length === 1 && metrics[0].label === 'Sin grupo')) {
		return null;
	}

	return (
		<section className="guest-group-metrics" aria-labelledby="guest-group-metrics-title">
			<button
				type="button"
				className="guest-group-metrics__toggle"
				aria-expanded={open}
				aria-controls="guest-group-metrics-list"
				onClick={() => setToggled(!open)}
			>
				<span id="guest-group-metrics-title" className="guest-group-metrics__title">
					Por grupo
				</span>
				<span className="guest-group-metrics__hint">personas confirmadas de sus pases</span>
				<ChevronDownGlyph size={18} />
			</button>
			{open && (
				<ul id="guest-group-metrics-list" className="guest-group-metrics__list">
					{metrics.map((metric) => {
						const active = activeGroup === metric.value;
						return (
							<li key={metric.value}>
								<button
									type="button"
									className={`guest-group-metrics__row${active ? ' guest-group-metrics__row--active' : ''}`}
									aria-pressed={active}
									onClick={() => onSelectGroup(active ? 'all' : metric.value)}
								>
									<span className="guest-group-metrics__name">
										{metric.label}
									</span>
									<span className="guest-group-metrics__count">
										<strong>{metric.confirmed}</strong> de {metric.passes}
									</span>
									<GuestPassesBar
										size="small"
										total={metric.passes}
										label={`${metric.label}: ${metric.confirmed} confirmadas, ${metric.declined} no asistirán, ${metric.noAnswer} sin respuesta, de ${metric.passes} pases`}
										slices={[
											{ key: 'confirmed', value: metric.confirmed },
											{ key: 'declined', value: metric.declined },
										]}
									/>
									<span className="guest-group-metrics__detail">
										{metric.noAnswer > 0
											? `${metric.noAnswer} sin respuesta`
											: 'Todos respondieron'}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
			<p className="guest-group-metrics__note">
				Una invitación con varios grupos cuenta en cada uno.
			</p>
		</section>
	);
};

export default GuestGroupMetrics;
