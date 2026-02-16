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
}) => {
	return (
		<div className="dashboard-guests__filters">
			<input
				ref={searchInputRef}
				type="search"
				value={search}
				onChange={(event) => onSearchChange(event.target.value)}
				placeholder="Buscar invitado"
			/>
			<select
				value={status}
				onChange={(event) => onStatusChange(event.target.value as typeof status)}
			>
				<option value="all">Todos</option>
				<option value="pending">Pendientes</option>
				<option value="confirmed">Confirmados</option>
				<option value="declined">Declinados</option>
				<option value="viewed">Vistos</option>
			</select>
			<button type="button" onClick={onRefreshClick} title="Recargar lista">
				Actualizar
			</button>
			<button type="button" onClick={onExportClick} className="btn-secondary">
				Exportar CSV
			</button>
			<button type="button" onClick={onImportClick} className="btn-secondary">
				Importar
			</button>
			<button type="button" onClick={onCreateClick} className="btn-primary">
				Agregar invitado
			</button>
		</div>
	);
};

export default GuestFilters;
