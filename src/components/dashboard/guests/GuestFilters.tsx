import React from 'react';

interface GuestFiltersProps {
	search: string;
	status: 'all' | 'pending' | 'confirmed' | 'declined';
	onSearchChange: (value: string) => void;
	onStatusChange: (value: 'all' | 'pending' | 'confirmed' | 'declined') => void;
	onCreateClick: () => void;
	onRefreshClick: () => void;
}

const GuestFilters: React.FC<GuestFiltersProps> = ({
	search,
	status,
	onSearchChange,
	onStatusChange,
	onCreateClick,
	onRefreshClick,
}) => {
	return (
		<div className="dashboard-guests__filters">
			<input
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
			</select>
			<button type="button" onClick={onRefreshClick}>
				Actualizar
			</button>
			<button type="button" onClick={onCreateClick}>
				Agregar invitado
			</button>
		</div>
	);
};

export default GuestFilters;
