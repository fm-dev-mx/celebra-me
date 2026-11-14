import React from 'react';

interface GuestLoadErrorProps {
	message: string;
	onRetry: () => void;
}

/** Load failure with a way to try again instead of a dead end. */
export const GuestLoadError: React.FC<GuestLoadErrorProps> = ({ message, onRetry }) => (
	<div className="dashboard-guests__error" role="alert">
		<p>{message}</p>
		<button type="button" className="btn-secondary" onClick={onRetry}>
			Reintentar
		</button>
	</div>
);

/** Placeholder shaped like the overview while the first list loads. */
export const GuestOverviewSkeleton: React.FC = () => (
	<div
		className="guest-overview guest-overview--loading"
		role="status"
		aria-label="Cargando resumen de invitados"
	>
		<div className="guest-overview__grid">
			<div className="guest-overview__skeleton" />
			<div className="guest-overview__skeleton" />
		</div>
	</div>
);

interface GuestListFeedbackProps {
	/** Nothing to report, e.g. while the message wall replaces the list. */
	hidden?: boolean;
	total: number;
	visible: number;
	filtered: boolean;
	onClear: () => void;
}

/** "Mostrando X de Y" while the list is narrowed, or a clear way out of an empty result. */
export const GuestListFeedback: React.FC<GuestListFeedbackProps> = ({
	hidden = false,
	total,
	visible,
	filtered,
	onClear,
}) => {
	if (hidden || total === 0) return null;
	if (visible === 0) {
		return (
			<div className="dashboard-guests__empty">
				<p>Ninguna invitación coincide con la búsqueda o el filtro.</p>
				<button type="button" className="btn-secondary" onClick={onClear}>
					Ver todas las invitaciones
				</button>
			</div>
		);
	}
	if (!filtered) return null;
	return (
		<div className="dashboard-guests__result-count">
			<p role="status">
				Mostrando {visible} de {total} {total === 1 ? 'invitación' : 'invitaciones'}
			</p>
			<button type="button" onClick={onClear}>
				Ver todas ({total})
			</button>
		</div>
	);
};
