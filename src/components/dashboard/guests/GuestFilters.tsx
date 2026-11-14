import React from 'react';
import { SearchIcon } from '@/components/common/icons/ui';
import type { GroupMetric } from '@/components/dashboard/guests/guest-presenter';

type GroupFilter = string;

interface GuestFiltersProps {
	search: string;
	group: GroupFilter;
	/** Groups present in the event, with counts; drives the group select. */
	groupMetrics: GroupMetric[];
	totalInvitations: number;
	onSearchChange: (value: string) => void;
	onGroupChange: (value: GroupFilter) => void;
	searchInputRef?: React.RefObject<HTMLInputElement | null>;
	/** Compact-screen actions shown beside the search, e.g. the "Más acciones" menu. */
	actions?: React.ReactNode;
}

/**
 * Search plus a labelled group select in one toolbar. Status filtering lives in
 * the overview stages, so there is a single vocabulary for invitation states.
 */
const GuestFilters: React.FC<GuestFiltersProps> = ({
	search,
	group,
	groupMetrics,
	totalInvitations,
	onSearchChange,
	onGroupChange,
	searchInputRef,
	actions,
}) => {
	const hasActiveFilters = search.trim() !== '' || group !== 'all';
	const options = [
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
				{groupMetrics.length > 0 && (
					<div className="filter-group filter-group--group">
						<div className="group-select">
							<label htmlFor="guest-group" className="group-select__label">
								Grupo
							</label>
							<select
								id="guest-group"
								className="group-select__input"
								value={group}
								onChange={(event) => onGroupChange(event.target.value)}
							>
								{options.map((option) => (
									<option key={option.value} value={option.value}>
										{`${option.label} (${option.count})`}
									</option>
								))}
							</select>
						</div>
					</div>
				)}
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
				{actions && <div className="filter-row__actions">{actions}</div>}
			</div>
		</div>
	);
};

export default GuestFilters;
