import React from 'react';
import { SearchIcon } from '@/components/common/icons/ui';
import { CheckGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import type { GroupMetric } from '@/components/dashboard/guests/guest-presenter';

export type GroupFilter = string;

interface GuestFiltersProps {
	search: string;
	group: GroupFilter;
	/** Groups present in the event, with counts; drives the chip row. */
	groupMetrics: GroupMetric[];
	totalInvitations: number;
	onSearchChange: (value: string) => void;
	onGroupChange: (value: GroupFilter) => void;
	searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Search plus one row of group chips. Status filtering lives in the overview
 * stages, so there is a single vocabulary for invitation states.
 */
const GuestFilters: React.FC<GuestFiltersProps> = ({
	search,
	group,
	groupMetrics,
	totalInvitations,
	onSearchChange,
	onGroupChange,
	searchInputRef,
}) => {
	const hasActiveFilters = search.trim() !== '' || group !== 'all';
	const chips = [
		{ value: 'all', label: 'Todos', count: totalInvitations },
		...groupMetrics.map((metric) => ({
			value: metric.value,
			label: metric.label,
			count: metric.invitations,
		})),
	];

	return (
		<div className="dashboard-guests__filters">
			<div className="filter-row">
				<div className="filter-group filter-group--search">
					<label htmlFor="guest-search">Buscar invitado</label>
					<div className="filter-search-wrap">
						<SearchIcon className="filter-search-icon" size={16} />
						<input
							id="guest-search"
							ref={searchInputRef}
							type="search"
							value={search}
							onChange={(event) => onSearchChange(event.target.value)}
							placeholder="Nombre o teléfono"
						/>
					</div>
				</div>
				{hasActiveFilters && (
					<button
						type="button"
						className="filter-clear-btn"
						onClick={() => {
							onSearchChange('');
							onGroupChange('all');
						}}
					>
						Limpiar filtros
					</button>
				)}
			</div>

			{groupMetrics.length > 0 && (
				<div className="group-chips" role="group" aria-label="Grupo">
					{chips.map((chip) => {
						const active = group === chip.value;
						return (
							<button
								key={chip.value}
								type="button"
								className={`group-chips__chip${active ? ' group-chips__chip--active' : ''}${chip.value !== 'all' && chip.label === 'Sin grupo' ? ' group-chips__chip--none' : ''}`}
								aria-pressed={active}
								onClick={() => onGroupChange(active ? 'all' : chip.value)}
							>
								{active && <CheckGlyph size={14} />}
								{chip.label}
								<span className="group-chips__count">{chip.count}</span>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default GuestFilters;
