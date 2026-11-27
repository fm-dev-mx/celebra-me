import type { FC } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';
import CreateUserModal from '@/components/dashboard/users/CreateUserModal';
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
import type { CreatedUserCredentialsDTO, InvitationHostDTO } from '@/lib/dashboard/dto/users';
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

/**
 * Renames the managed login when asked, then issues a new temporary password. Runs after the
 * invitation is already paid, so a failure here never undoes the payment.
 */
async function handOverCredentials(
	host: InvitationHostDTO,
	requestedLogin: string,
): Promise<CreatedUserCredentialsDTO> {
	let login = host.login;
	const alias = requestedLogin.trim().toLowerCase();
	if (host.managed && alias && alias !== host.login) {
		const renamed = await adminApi.updateUserLoginAlias(host.userId, { loginAlias: alias });
		if (!renamed.item) throw new Error('El usuario de acceso no fue modificado.');
		login = renamed.item.email;
	}
	const reset = await adminApi.resetUserPassword(host.userId);
	if (!reset.credentials) {
		throw new Error('No se generó una contraseña porque el cambio no fue aplicado.');
	}
	return {
		email: login,
		role: 'host_client',
		temporaryPassword: reset.credentials.temporaryPassword,
	};
}

/** Administrator-only panel: payment status and public access of a client invitation. */
const InvitationAccessPanel: FC<Props> = ({ invitationId, archived }) => {
	const noteId = useId();
	const [access, setAccess] = useState<InvitationAccessRecord | null>(null);
	const [host, setHost] = useState<InvitationHostDTO | null>(null);
	const [handOver, setHandOver] = useState(true);
	const [newLogin, setNewLogin] = useState('');
	const [credentials, setCredentials] = useState<CreatedUserCredentialsDTO | null>(null);
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
			const loaded = await adminApi.getInvitationAccess(invitationId);
			setAccess(loaded.item);
			setHost(loaded.host);
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
			if (pendingAction === 'mark_paid' && host && handOver) {
				try {
					const issued = await handOverCredentials(host, newLogin);
					setHost({ ...host, login: issued.email });
					setNewLogin('');
					setCredentials(issued);
				} catch (error) {
					setFeedback({
						kind: 'error',
						text: `La invitación quedó pagada, pero no se generaron credenciales nuevas: ${toErrorMessage(error, 'error desconocido.')} Restablézcalas desde Usuarios.`,
					});
				}
			}
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
				>
					{pendingAction === 'mark_paid' && host && (
						<div className="invitation-access__handover">
							<label className="invitation-access__handover-toggle">
								<input
									type="checkbox"
									checked={handOver}
									onChange={(event) => setHandOver(event.target.checked)}
									disabled={saving}
								/>
								Entregar credenciales nuevas a {host.login}
							</label>
							{handOver && host.managed && (
								<div className="dashboard-form-field">
									<label htmlFor={`${noteId}-login`}>
										Nuevo usuario (opcional)
									</label>
									<input
										id={`${noteId}-login`}
										type="text"
										value={newLogin}
										onChange={(event) => setNewLogin(event.target.value)}
										placeholder={host.login}
										autoComplete="off"
										disabled={saving}
									/>
								</div>
							)}
							{handOver && (
								<p className="dashboard-form-help">
									Se genera una contraseña temporal nueva y la anterior deja de
									funcionar. El cliente creará la suya al iniciar sesión.
								</p>
							)}
						</div>
					)}
				</ConfirmModal>
			)}
			{credentials && (
				<CreateUserModal
					busy={false}
					error=""
					createdUser={credentials}
					onClose={() => setCredentials(null)}
					onSubmit={async () => undefined}
				/>
			)}
		</section>
	);
};

export default InvitationAccessPanel;
