import type { FC } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';
import InvitationAccessBadges from '@/components/dashboard/intake/InvitationAccessBadges';
import {
	INVITATION_ACCESS_ACTION_COPY,
	availableAccessActions,
	buildAccessCommand,
	type InvitationAccessAction,
} from '@/components/dashboard/intake/invitation-access-actions';
import { adminApi } from '@/lib/dashboard/admin-api';
import {
	INVITATION_ACCESS_NOTE_MAX_LENGTH,
	type InvitationAccessRecord,
} from '@/lib/invitation/access/invitation-access-command';
import { ApiError, toErrorMessage } from '@/lib/rsvp/core/errors';

interface Props {
	invitationId: string;
	archived: boolean;
}

function explain(access: InvitationAccessRecord): string {
	if (access.publicAccess === 'disabled') {
		return 'Los invitados ven una página neutral: «Esta invitación no está disponible por el momento».';
	}
	if (access.paymentStatus === 'unpaid') {
		return 'Los invitados ven la invitación completa con la marca «Vista previa · Celebra-me».';
	}
	return 'La invitación se muestra sin marcas de vista previa.';
}

/** Administrator-only panel: payment status and public access of a client invitation. */
const InvitationAccessPanel: FC<Props> = ({ invitationId, archived }) => {
	const noteId = useId();
	const [access, setAccess] = useState<InvitationAccessRecord | null>(null);
	const [loadError, setLoadError] = useState('');
	const [pendingAction, setPendingAction] = useState<InvitationAccessAction | null>(null);
	const [saving, setSaving] = useState(false);
	const [note, setNote] = useState('');
	const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
		null,
	);

	const load = useCallback(async () => {
		setLoadError('');
		try {
			setAccess(await adminApi.getInvitationAccess(invitationId));
		} catch (error) {
			setLoadError(toErrorMessage(error, 'No se pudo cargar el estado de pago.'));
		}
	}, [invitationId]);

	useEffect(() => {
		void load();
	}, [load]);

	const confirm = async () => {
		if (!access || !pendingAction) return;
		setSaving(true);
		setFeedback(null);
		try {
			const updated = await adminApi.setInvitationAccess(
				invitationId,
				buildAccessCommand(pendingAction, access.version, note),
			);
			setAccess(updated);
			setNote('');
			setFeedback({
				kind: 'success',
				text: INVITATION_ACCESS_ACTION_COPY[pendingAction].success,
			});
		} catch (error) {
			setFeedback({
				kind: 'error',
				text: toErrorMessage(error, 'No se pudo guardar el cambio.'),
			});
			if (error instanceof ApiError && error.status === 409) void load();
		} finally {
			setSaving(false);
			setPendingAction(null);
		}
	};

	const actions = access ? availableAccessActions(access) : null;
	const copy = pendingAction ? INVITATION_ACCESS_ACTION_COPY[pendingAction] : null;

	return (
		<section
			className="intake-detail__section invitation-access"
			aria-labelledby={`${noteId}-title`}
		>
			<h3 id={`${noteId}-title`} className="intake-detail__section-title">
				Pago y visibilidad pública
			</h3>
			{loadError && (
				<p
					className="invitation-access__feedback invitation-access__feedback--error"
					role="alert"
				>
					{loadError}
				</p>
			)}
			{access && actions && (
				<>
					<InvitationAccessBadges access={access} showAll />
					<p className="invitation-access__explanation">{explain(access)}</p>
					{access.publicAccess === 'disabled' && access.internalNote && (
						<p className="invitation-access__note">
							Nota interna: {access.internalNote}
						</p>
					)}
					<p className="invitation-access__meta">
						Último cambio: {new Date(access.updatedAt).toLocaleString('es-MX')}
					</p>
					{archived ? (
						<p className="invitation-access__meta">
							Restaure la invitación para cambiar su estado.
						</p>
					) : (
						<>
							{access.publicAccess === 'enabled' && (
								<div className="dashboard-form-field invitation-access__note-field">
									<label htmlFor={noteId}>
										Nota interna al deshabilitar (opcional)
									</label>
									<textarea
										id={noteId}
										value={note}
										maxLength={INVITATION_ACCESS_NOTE_MAX_LENGTH}
										onChange={(event) => setNote(event.target.value)}
										rows={2}
									/>
								</div>
							)}
							<div className="invitation-access__actions">
								{actions.map((action) => (
									<button
										key={action}
										type="button"
										className="btn-secondary btn--compact"
										onClick={() => setPendingAction(action)}
										disabled={saving}
									>
										{INVITATION_ACCESS_ACTION_COPY[action].menuLabel}
									</button>
								))}
							</div>
						</>
					)}
				</>
			)}
			{feedback && (
				<p
					className={`invitation-access__feedback invitation-access__feedback--${feedback.kind}`}
					role={feedback.kind === 'error' ? 'alert' : 'status'}
				>
					{feedback.text}
				</p>
			)}
			{copy && (
				<ConfirmModal
					title={copy.title}
					message={copy.message}
					confirmLabel={copy.confirmLabel}
					destructive={copy.destructive}
					loading={saving}
					onConfirm={() => void confirm()}
					onCancel={() => setPendingAction(null)}
				/>
			)}
		</section>
	);
};

export default InvitationAccessPanel;
