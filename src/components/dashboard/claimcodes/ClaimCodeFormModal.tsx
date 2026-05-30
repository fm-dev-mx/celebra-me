import React, { useEffect, useState, type SyntheticEvent } from 'react';
import type { CreateClaimCodeDTO } from '@/lib/dashboard/dto/claimcodes';
import { toErrorMessage } from '@/lib/rsvp/core/errors';

interface ProjectOption {
	id: string;
	title: string;
	eventType: string;
	rsvpEventId: string | null;
}

interface ClaimCodeFormModalProps {
	projects: ProjectOption[];
	loading: boolean;
	onCreate: (payload: CreateClaimCodeDTO) => Promise<void>;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
	xv: 'XV años',
	boda: 'Boda',
	bautizo: 'Bautizo',
	cumple: 'Cumpleaños',
};

const ClaimCodeFormModal: React.FC<ClaimCodeFormModalProps> = ({ projects, loading, onCreate }) => {
	const [projectId, setProjectId] = useState('');
	const [maxUses, setMaxUses] = useState(1);
	const [expiresAt, setExpiresAt] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const projectsWithRsvp = projects.filter((p) => p.rsvpEventId);

	useEffect(() => {
		if (projectsWithRsvp.length > 0 && !projectId) {
			setProjectId(projectsWithRsvp[0].id);
		}
		if (projectsWithRsvp.length === 0 && projectId) {
			setProjectId('');
		}
	}, [projectId, projectsWithRsvp]);

	const handleSubmit = async (event: SyntheticEvent) => {
		event.preventDefault();
		if (busy || !projectId) return;
		setBusy(true);
		setError('');
		try {
			const selected = projectsWithRsvp.find((p) => p.id === projectId);
			await onCreate({
				invitationProjectId: projectId.trim(),
				eventId: selected?.rsvpEventId ?? undefined,
				maxUses,
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
			});
			const next = projectsWithRsvp.find((p) => p.id !== projectId);
			setProjectId(next?.id ?? (projectsWithRsvp.length > 0 ? projectsWithRsvp[0].id : ''));
			setMaxUses(1);
			setExpiresAt('');
		} catch (err) {
			setError(toErrorMessage(err, 'Error al crear el código de acceso.'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<form className="dashboard-form-grid" onSubmit={handleSubmit}>
			<div className="dashboard-form-field">
				<label htmlFor="claim-project">Proyecto de invitación</label>
				{loading ? (
					<select id="claim-project" disabled>
						<option>Cargando proyectos...</option>
					</select>
				) : (
					<select
						id="claim-project"
						value={projectId}
						onChange={(event) => setProjectId(event.target.value)}
						required
						disabled={projectsWithRsvp.length === 0}
					>
						<option value="">Selecciona un proyecto</option>
						{projectsWithRsvp.map((project) => (
							<option key={project.id} value={project.id}>
								{project.title} (
								{EVENT_TYPE_LABELS[project.eventType] ?? project.eventType})
							</option>
						))}
					</select>
				)}
				{projectsWithRsvp.length === 0 && !loading && (
					<p className="dashboard-form-help">
						No hay proyectos con RSVP disponibles. Publica una invitación primero.
					</p>
				)}
			</div>
			<div className="dashboard-form-field">
				<label htmlFor="claim-max-uses">Usos máximos</label>
				<input
					id="claim-max-uses"
					type="number"
					min={1}
					max={10000}
					value={maxUses}
					onChange={(event) => setMaxUses(Number.parseInt(event.target.value || '1', 10))}
					required
				/>
				<p className="dashboard-form-help">Mínimo 1, máximo 10000</p>
			</div>
			<div className="dashboard-form-field">
				<label htmlFor="claim-expires">Expira en (opcional)</label>
				<input
					id="claim-expires"
					type="datetime-local"
					value={expiresAt}
					onChange={(event) => setExpiresAt(event.target.value)}
					min={new Date().toISOString().slice(0, 16)}
				/>
				<p className="dashboard-form-help">Deja vacío para que no expire</p>
			</div>
			{error && <p className="dashboard-error dashboard-error--full">{error}</p>}
			<div className="dashboard-actions dashboard-actions--full">
				<button
					type="submit"
					className="btn-primary"
					disabled={busy || !projectId || projectsWithRsvp.length === 0}
				>
					{busy ? 'Generando...' : 'Generar código de acceso'}
				</button>
			</div>
		</form>
	);
};

export default ClaimCodeFormModal;
