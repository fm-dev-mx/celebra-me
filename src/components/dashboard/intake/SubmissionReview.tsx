import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import type { IntakeBlockType } from '@/lib/intake/types';

interface Props {
	projectId: string;
}

const BLOCK_LABELS: Record<IntakeBlockType, string> = {
	'event-details': 'Detalles del evento',
	'main-people': 'Personas principales',
	'date-locations': 'Fecha y ubicaciones',
	photos: 'Fotografias',
	'rsvp-config': 'Confirmacion de asistencia',
	music: 'Musica de fondo',
	gifts: 'Mesa de regalos',
	'special-messages': 'Mensajes especiales',
};

const STATUS_LABELS: Record<string, string> = {
	in_progress: 'En progreso',
	submitted: 'Enviada',
	needs_changes: 'Requiere cambios',
	approved: 'Aprobada',
};

const SubmissionReview: FC<Props> = ({ projectId }) => {
	const {
		loading,
		error,
		currentProject,
		currentSubmission,
		currentRequest,
		loadSubmissionForReview,
		reviewSubmission,
	} = useInvitationAdmin();

	const [reviewNotes, setReviewNotes] = useState('');
	const [actionLoading, setActionLoading] = useState('');
	const [actionError, setActionError] = useState('');
	const [actionSuccess, setActionSuccess] = useState('');

	useEffect(() => {
		void loadSubmissionForReview(projectId);
	}, [projectId, loadSubmissionForReview]);

	const handleAction = async (action: 'approve' | 'request_changes') => {
		if (action === 'request_changes' && !reviewNotes.trim()) {
			setActionError('Las notas son obligatorias al solicitar cambios.');
			return;
		}

		setActionLoading(action);
		setActionError('');
		setActionSuccess('');

		try {
			await reviewSubmission(projectId, action, reviewNotes);
			setActionSuccess(
				action === 'approve'
					? 'Captura aprobada exitosamente.'
					: 'Se solicitaron cambios al cliente.',
			);
			setReviewNotes('');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al procesar la accion.');
		} finally {
			setActionLoading('');
		}
	};

	if (loading) {
		return <div className="intake-review__loading">Cargando captura...</div>;
	}

	if (error) {
		return <div className="intake-review__error">{error}</div>;
	}

	if (!currentSubmission) {
		return (
			<div className="intake-review__empty">No se encontro captura para este proyecto.</div>
		);
	}

	const blockData = currentSubmission.blockData ?? {};
	const photoNotes = currentSubmission.photoNotes ?? {};
	const enabledBlocks = currentRequest?.enabledBlocks ?? [];

	return (
		<div className="intake-review">
			<header className="intake-review__header">
				<h2 className="intake-review__title">Revision: {currentProject?.title}</h2>
				<div className="intake-review__meta">
					<span className="intake-review__badge">
						Estado:{' '}
						{STATUS_LABELS[currentSubmission.status] ?? currentSubmission.status}
					</span>
					{currentSubmission.submittedAt && (
						<span className="intake-review__date">
							Enviada:{' '}
							{new Date(currentSubmission.submittedAt).toLocaleString('es-MX')}
						</span>
					)}
				</div>
			</header>

			{currentSubmission.reviewNotes && (
				<div className="intake-review__previous-notes">
					<h4>Notas de revision anterior:</h4>
					<p>{currentSubmission.reviewNotes}</p>
				</div>
			)}

			<div className="intake-review__sections">
				{enabledBlocks.map((blockType) => {
					const data = blockData[blockType];
					if (!data) return null;

					return (
						<section key={blockType} className="intake-review__section">
							<h3 className="intake-review__section-title">
								{BLOCK_LABELS[blockType] ?? blockType}
							</h3>
							<dl className="intake-review__fields">
								{Object.entries(data as Record<string, unknown>).map(
									([key, value]) => {
										if (
											value === '' ||
											value === undefined ||
											value === null ||
											key === '_pending'
										)
											return null;
										return (
											<div key={key} className="intake-review__field">
												<dt className="intake-review__key">{key}</dt>
												<dd className="intake-review__value">
													{typeof value === 'boolean' ? (
														value ? (
															'Si'
														) : (
															'No'
														)
													) : typeof value === 'object' ? (
														<pre>{JSON.stringify(value, null, 2)}</pre>
													) : (
														String(value)
													)}
												</dd>
											</div>
										);
									},
								)}
							</dl>
						</section>
					);
				})}
			</div>

			{Object.keys(photoNotes).length > 0 && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">Notas de fotos</h3>
					<dl className="intake-review__fields">
						{Object.entries(photoNotes).map(([key, value]) => (
							<div key={key} className="intake-review__field">
								<dt className="intake-review__key">{key}</dt>
								<dd className="intake-review__value">{String(value)}</dd>
							</div>
						))}
					</dl>
				</section>
			)}

			{currentSubmission.clientComments && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">Comentarios del cliente</h3>
					<p className="intake-review__comments">{currentSubmission.clientComments}</p>
				</section>
			)}

			<div className="intake-review__actions">
				<div className="intake-review__notes-field">
					<label className="intake-field__label" htmlFor="reviewNotes">
						Notas de revision
					</label>
					<textarea
						id="reviewNotes"
						className="intake-field__textarea"
						value={reviewNotes}
						onChange={(e) => setReviewNotes(e.target.value)}
						placeholder="Notas para el cliente (obligatorio si solicitas cambios)..."
						rows={3}
					/>
				</div>

				{actionError && <p className="intake-review__error">{actionError}</p>}
				{actionSuccess && <p className="intake-review__success">{actionSuccess}</p>}

				<div className="intake-review__buttons">
					<button
						type="button"
						className="intake-review__btn intake-review__btn--approve"
						onClick={() => handleAction('approve')}
						disabled={actionLoading !== '' || currentSubmission.status === 'approved'}
					>
						{actionLoading === 'approve' ? 'Aprobando...' : 'Aprobar captura'}
					</button>
					<button
						type="button"
						className="intake-review__btn intake-review__btn--changes"
						onClick={() => handleAction('request_changes')}
						disabled={actionLoading !== '' || currentSubmission.status === 'approved'}
					>
						{actionLoading === 'request_changes' ? 'Enviando...' : 'Solicitar cambios'}
					</button>
				</div>
			</div>
		</div>
	);
};

export default SubmissionReview;
