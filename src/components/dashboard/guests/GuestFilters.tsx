import React from 'react';
import { SearchIcon } from '@/components/common/icons/ui';

interface GuestFiltersProps {
	search: string;
	status: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed';
	onSearchChange: (value: string) => void;
	onStatusChange: (value: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed') => void;
	onImportClick: () => void;
	onRefreshClick: () => void;
	onExportClick: () => void;
	searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

const GuestFilters: React.FC<GuestFiltersProps> = ({
	search,
	status,
	onSearchChange,
	onStatusChange,
	onImportClick,
	onRefreshClick,
	onExportClick,
	searchInputRef,
}) => {
	return (
		<div className="dashboard-guests__filters">
			<div className="filter-group">
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

			<div className="filter-row">
				<div className="filter-group filter-group--compact">
					<label htmlFor="status-filter">Filtro</label>
					<select
						id="status-filter"
						value={status}
						onChange={(event) => onStatusChange(event.target.value as typeof status)}
					>
						<option value="all">Todos</option>
						<option value="pending">En espera</option>
						<option value="confirmed">Confirmados</option>
						<option value="declined">No asistirán</option>
						<option value="viewed">Vistos</option>
					</select>
				</div>

				<div className="filter-actions-group">
					<button
						type="button"
						onClick={onExportClick}
						className="btn-secondary btn--compact"
					>
						Exportar
					</button>
					<button
						type="button"
						onClick={onImportClick}
						className="btn-secondary btn--compact"
					>
						Importar
					</button>
					<button
						type="button"
						onClick={onRefreshClick}
						className="btn-secondary btn--compact"
						title="Recargar lista"
					>
						Actualizar
					</button>
				</div>
			</div>
		</div>
	);
};

export default GuestFilters;
