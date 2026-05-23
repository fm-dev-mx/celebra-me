import React, { useCallback, useEffect, useState } from 'react';
import { SearchIcon } from '@/components/common/icons/ui';
import type { DeliveryFilter } from '@/interfaces/rsvp/domain.interface';

interface GuestFiltersProps {
	search: string;
	status: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed';
	delivery: DeliveryFilter;
	onSearchChange: (value: string) => void;
	onStatusChange: (value: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed') => void;
	onDeliveryChange: (value: DeliveryFilter) => void;
	searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

const GuestFilters: React.FC<GuestFiltersProps> = ({
	search,
	status,
	delivery,
	onSearchChange,
	onStatusChange,
	onDeliveryChange,
	searchInputRef,
}) => {
	const [showAdvanced, setShowAdvanced] = useState(false);
	const hasActiveFilters = status !== 'all' || delivery !== 'all';

	useEffect(() => {
		setShowAdvanced(hasActiveFilters);
	}, [hasActiveFilters]);

	const handleClearFilters = useCallback(() => {
		onSearchChange('');
		onStatusChange('all');
		onDeliveryChange('all');
	}, [onSearchChange, onStatusChange, onDeliveryChange]);

	return (
		<div className="dashboard-guests__filters">
			<div className="filter-row">
				<div className="filter-group filter-group--search">
					<label htmlFor="guest-search">Buscar</label>
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

				<div className="filter-advanced-toggle">
					<button
						type="button"
						className="filter-advanced-toggle__btn"
						onClick={() => setShowAdvanced((prev) => !prev)}
						aria-expanded={showAdvanced}
						aria-controls="advanced-filters"
					>
						<span>Filtros</span>
						{hasActiveFilters && (
							<span
								className="filter-active-indicator"
								aria-label="Filtros activos"
							/>
						)}
					</button>
				</div>
			</div>

			<div
				id="advanced-filters"
				className={`filter-advanced${showAdvanced ? ' filter-advanced--open' : ''}`}
			>
				<div className="filter-row">
					<div className="filter-group filter-group--compact">
						<label htmlFor="status-filter">Filtro</label>
						<select
							id="status-filter"
							value={status}
							onChange={(event) =>
								onStatusChange(event.target.value as typeof status)
							}
						>
							<option value="all">Todos</option>
							<option value="pending">En espera</option>
							<option value="confirmed">Confirmados</option>
							<option value="declined">No asistirán</option>
							<option value="viewed">Vistos</option>
						</select>
					</div>

					<div className="filter-group filter-group--compact">
						<label htmlFor="delivery-filter">Entrega</label>
						<select
							id="delivery-filter"
							value={delivery}
							onChange={(event) =>
								onDeliveryChange(event.target.value as typeof delivery)
							}
						>
							<option value="all">Todas</option>
							<option value="generated">No enviadas</option>
							<option value="shared">Enviadas</option>
						</select>
					</div>

					{hasActiveFilters && (
						<button
							type="button"
							className="filter-clear-btn"
							onClick={handleClearFilters}
						>
							Limpiar filtros
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default GuestFilters;
