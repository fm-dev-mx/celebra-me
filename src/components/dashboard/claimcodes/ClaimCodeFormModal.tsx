import React, { useEffect, useState, type SyntheticEvent } from 'react';
import type { CreateClaimCodeDTO } from '@/lib/dashboard/dto/claimcodes';
import { toErrorMessage } from '@/lib/rsvp/core/errors';
import { EVENT_TYPE_LABELS } from '@/lib/intake/labels';
import { isEventType } from '@/lib/theme/theme-contract';

interface ProjectOption {
	id: string;
	title: string;
	eventType: string;
	rsvpEventId: string | null;
}

interface ClaimCodeFormModalProps {
	invitations: ProjectOption[];
	loading: boolean;
	onCreate: (payload: CreateClaimCodeDTO) => Promise<void>;
}

const ClaimCodeFormModal: React.FC<ClaimCodeFormModalProps> = ({
	invitations,
	loading,
	onCreate,
}) => {
	const [invitationId, setInvitationId] = useState('');
	const [maxUses, setMaxUses] = useState(1);
	const [expiresAt, setExpiresAt] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const invitationsWithRsvp = invitations.filter((p) => p.rsvpEventId);

	useEffect(() => {
		if (invitationsWithRsvp.length > 0 && !invitationId) {
			setInvitationId(invitationsWithRsvp[0].id);
		}
		if (invitationsWithRsvp.length === 0 && invitationId) {
			setInvitationId('');
		}
	}, [invitationId, invitationsWithRsvp]);

	const handleSubmit = async (event: SyntheticEvent) => {
		event.preventDefault();
		if (busy || !invitationId) return;
		setBusy(true);
		setError('');
		try {
			const selected = invitationsWithRsvp.find((p) => p.id === invitationId);
			await onCreate({
				invitationId: invitationId.trim(),
				eventId: selected?.rsvpEventId ?? undefined,
				maxUses,
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
			});
			const next = invitationsWithRsvp.find((p) => p.id !== invitationId);
			setInvitationId(
				next?.id ?? (invitationsWithRsvp.length > 0 ? invitationsWithRsvp[0].id : ''),
			);
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
				<label htmlFor="claim-invitation">Invitación</label>
				{loading ? (
					<select id="claim-invitation" disabled>
						<option>Cargando invitaciones...</option>
					</select>
				) : (
					<select
						id="claim-invitation"
						value={invitationId}
						onChange={(event) => setInvitationId(event.target.value)}
						required
						disabled={invitationsWithRsvp.length === 0}
					>
						<option value="">Selecciona una invitación</option>
						{invitationsWithRsvp.map((invitation) => (
							<option key={invitation.id} value={invitation.id}>
								{invitation.title} (
								{isEventType(invitation.eventType)
									? EVENT_TYPE_LABELS[invitation.eventType]
									: invitation.eventType}
								)
							</option>
						))}
					</select>
				)}
				{invitationsWithRsvp.length === 0 && !loading && (
					<p className="dashboard-form-help">
						No hay invitaciones con RSVP disponibles. Publica una invitación primero.
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
					disabled={busy || !invitationId || invitationsWithRsvp.length === 0}
				>
					{busy ? 'Generando...' : 'Generar código de acceso'}
				</button>
			</div>
		</form>
	);
};

export default ClaimCodeFormModal;
