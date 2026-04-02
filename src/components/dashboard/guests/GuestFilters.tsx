import React from 'react';

interface GuestFiltersProps {
	search: string;
	status: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed';
	onSearchChange: (value: string) => void;
	onStatusChange: (value: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed') => void;
	onCreateClick: () => void;
	onImportClick: () => void;
	onRefreshClick: () => void;
	onExportClick: () => void;
	searchInputRef?: React.RefObject<HTMLInputElement | null>;
	createDisabled?: boolean;
}

const GuestFilters: React.FC<GuestFiltersProps> = ({
	search,
	status,
	onSearchChange,
	onStatusChange,
	onCreateClick,
	onImportClick,
	onRefreshClick,
	onExportClick,
	searchInputRef,
	createDisabled,
}) => {
	return (
		<div className="dashboard-guests__filters">
			<div className="filter-group">
				<label htmlFor="guest-search">Buscar por nombre o teléfono</label>
				<input
					id="guest-search"
					ref={searchInputRef}
					type="search"
					value={search}
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder="Ej. Juan Pérez"
				/>
			</div>

			<div className="filter-group">
				<label htmlFor="status-filter">Filtrar por estado</label>
				<select
					id="status-filter"
					value={status}
					onChange={(event) => onStatusChange(event.target.value as typeof status)}
				>
					<option value="all">Todos los invitados</option>
					<option value="pending">Pendientes</option>
					<option value="confirmed">Confirmados</option>
					<option value="declined">Declinados</option>
					<option value="viewed">Vistos</option>
				</select>
			</div>

			<div className="header-actions">
				<button
					type="button"
					onClick={onExportClick}
					className="btn-secondary btn--utility"
				>
					Exportar CSV
				</button>
				<button
					type="button"
					onClick={onImportClick}
					className="btn-secondary btn--utility"
				>
					Importar lista
				</button>
				<button
					type="button"
					onClick={onRefreshClick}
					className="btn-secondary btn--utility"
					title="Recargar lista"
				>
					Actualizar
				</button>
				<button
					type="button"
					onClick={onCreateClick}
					className="btn-primary"
					disabled={createDisabled}
				>
					Nuevo invitado
				</button>
			</div>
		</div>
	);
};

export default GuestFilters;
