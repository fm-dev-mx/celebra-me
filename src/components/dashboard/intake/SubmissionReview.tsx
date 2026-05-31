import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import { INTAKE_BLOCK_COMPONENTS } from '@/components/intake/block-components';
import { SUBMISSION_STATUS_LABELS } from '@/lib/intake/labels';
import { validateBlockData } from '@/lib/intake/schemas/intake-submission.schema';
import type { IntakeSubmissionDTO } from '@/lib/dashboard/dto/intake';

interface Props {
	projectId: string;
}

function renderLoadState(loading: boolean, error: string, submission: IntakeSubmissionDTO | null) {
	if (loading) return <div className="intake-review__loading">Cargando captura...</div>;
	if (error) return <div className="intake-review__error">{error}</div>;
	if (!submission) {
		return (
			<div className="intake-review__empty">
				No se encontró una captura enviada para este proyecto.
			</div>
		);
	}
	return null;
}

function PreviousReviewNotes({ notes }: { notes: string }) {
	if (!notes) return null;
	return (
		<div className="intake-review__previous-notes">
			<h4>Notas de revisión anterior:</h4>
			<p>{notes}</p>
		</div>
	);
}

function ActionFeedback({ error, success }: { error: string; success: string }) {
	return (
		<>
			{error && <p className="intake-review__error">{error}</p>}
			{success && <p className="intake-review__success">{success}</p>}
		</>
	);
}

const SubmissionReview: FC<Props> = ({ projectId }) => {
	const {
		loading,
		error,
		currentProject,
		currentSubmission,
		currentRequest,
		loadSubmissionForReview,
		reviewSubmission,
		saveSubmissionCorrections,
	} = useInvitationAdmin();
	const [editing, setEditing] = useState(false);
	const [blockData, setBlockData] = useState<Record<string, unknown>>({});
	const [clientComments, setClientComments] = useState('');
	const [reviewNotes, setReviewNotes] = useState('');
	const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
	const [actionLoading, setActionLoading] = useState('');
	const [actionError, setActionError] = useState('');
	const [actionSuccess, setActionSuccess] = useState('');

	useEffect(() => {
		void loadSubmissionForReview(projectId);
	}, [projectId, loadSubmissionForReview]);

	useEffect(() => {
		if (!currentSubmission || editing) return;
		setBlockData(currentSubmission.blockData ?? {});
		setClientComments(currentSubmission.clientComments ?? '');
	}, [currentSubmission, editing]);

	const dirty = useMemo(() => {
		if (!currentSubmission) return false;
		return (
			JSON.stringify(blockData) !== JSON.stringify(currentSubmission.blockData ?? {}) ||
			clientComments !== (currentSubmission.clientComments ?? '')
		);
	}, [blockData, clientComments, currentSubmission]);

	const resetLocalState = useCallback(() => {
		if (!currentSubmission) return;
		setBlockData(currentSubmission.blockData ?? {});
		setClientComments(currentSubmission.clientComments ?? '');
		setValidationErrors({});
	}, [currentSubmission]);

	const updateBlockField = (blockType: string, field: string, value: unknown) => {
		setBlockData((previous) => ({
			...previous,
			[blockType]: {
				...((previous[blockType] as Record<string, unknown>) ?? {}),
				[field]: value,
			},
		}));
		setValidationErrors((previous) => {
			const next = { ...previous };
			delete next[blockType];
			return next;
		});
	};

	const validateCorrections = () => {
		const errors: Record<string, string> = {};
		for (const blockType of currentRequest?.enabledBlocks ?? []) {
			const result = validateBlockData(blockType, blockData[blockType] ?? {});
			if (!result.success) {
				errors[blockType] = result.error.issues.map((issue) => issue.message).join(', ');
			}
		}
		setValidationErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const withAction = useCallback(
		async <T,>(actionName: string, fn: () => Promise<T>, onSuccess?: (result: T) => void) => {
			setActionLoading(actionName);
			setActionError('');
			setActionSuccess('');
			try {
				const result = await fn();
				onSuccess?.(result);
			} catch (err) {
				setActionError(err instanceof Error ? err.message : 'Error inesperado.');
			} finally {
				setActionLoading('');
			}
		},
		[],
	);

	const handleSave = async () => {
		if (!validateCorrections()) return;
		await withAction(
			'save',
			() => saveSubmissionCorrections(projectId, { blockData, clientComments }),
			() => {
				setEditing(false);
				setActionSuccess('Correcciones guardadas exitosamente.');
			},
		);
	};

	const handleCancel = useCallback(() => {
		setEditing(false);
		resetLocalState();
	}, [resetLocalState]);

	const handleAction = async (action: 'approve' | 'request_changes') => {
		if (dirty || editing) {
			setActionError('Guarda o cancela las correcciones antes de continuar.');
			return;
		}
		if (action === 'request_changes' && !reviewNotes.trim()) {
			setActionError('Las notas son obligatorias al solicitar cambios.');
			return;
		}
		await withAction(
			action,
			() => reviewSubmission(projectId, action, reviewNotes),
			() => {
				setActionSuccess(
					action === 'approve'
						? 'Captura aprobada exitosamente.'
						: 'Se solicitaron cambios al cliente.',
				);
				setReviewNotes('');
			},
		);
	};

	const loadState = renderLoadState(loading, error, currentSubmission);
	if (loadState) return loadState;

	if (!currentSubmission) return null;
	const editable = currentSubmission.status === 'submitted';

	return (
		<div className="intake-review">
			<header className="intake-review__header">
				<a href={`/dashboard/invitaciones/${projectId}`} className="intake-detail__back">
					&larr; Volver
				</a>
				<h2 className="intake-review__title">Revisión: {currentProject?.title}</h2>
				<div className="intake-review__meta">
					<span className="intake-review__badge">
						Estado: {SUBMISSION_STATUS_LABELS[currentSubmission.status]}
					</span>
					{currentSubmission.submittedAt && (
						<span className="intake-review__date">
							Enviada:{' '}
							{new Date(currentSubmission.submittedAt).toLocaleString('es-MX')}
						</span>
					)}
				</div>
			</header>

			<PreviousReviewNotes notes={currentSubmission.reviewNotes} />

			{editable && !editing && (
				<button
					type="button"
					className="intake-review__btn intake-review__edit-btn"
					onClick={() => setEditing(true)}
				>
					Editar correcciones
				</button>
			)}

			<div className="intake-review__sections">
				{(currentRequest?.enabledBlocks ?? []).map((blockType) => {
					const BlockComponent = INTAKE_BLOCK_COMPONENTS[blockType];
					return (
						<section key={blockType} className="intake-review__section">
							<BlockComponent
								data={(blockData[blockType] as Record<string, unknown>) ?? {}}
								onChange={(field, value) =>
									updateBlockField(blockType, field, value)
								}
								disabled={!editing}
								eventType={
									(currentProject?.eventType ?? 'xv') as
										| 'xv'
										| 'boda'
										| 'bautizo'
										| 'cumple'
								}
							/>
							{validationErrors[blockType] && (
								<p className="intake-review__error">
									{validationErrors[blockType]}
								</p>
							)}
						</section>
					);
				})}
			</div>

			<section className="intake-review__section">
				<label className="intake-field__label" htmlFor="clientComments">
					Comentarios del cliente
				</label>
				<textarea
					id="clientComments"
					className="intake-field__textarea"
					value={clientComments}
					onChange={(event) => setClientComments(event.target.value)}
					disabled={!editing}
					rows={4}
				/>
			</section>

			{editing && (
				<div className="intake-review__buttons">
					<button
						type="button"
						className="intake-review__btn intake-review__btn--approve"
						onClick={handleSave}
						disabled={actionLoading !== ''}
					>
						{actionLoading === 'save' ? 'Guardando...' : 'Guardar correcciones'}
					</button>
					<button
						type="button"
						className="intake-review__btn intake-review__btn--changes"
						onClick={handleCancel}
						disabled={actionLoading !== ''}
					>
						Cancelar
					</button>
				</div>
			)}

			<div className="intake-review__actions">
				<label className="intake-field__label" htmlFor="reviewNotes">
					Notas de revisión
				</label>
				<textarea
					id="reviewNotes"
					className="intake-field__textarea"
					value={reviewNotes}
					onChange={(event) => setReviewNotes(event.target.value)}
					rows={3}
				/>
				<ActionFeedback error={actionError} success={actionSuccess} />
				<div className="intake-review__buttons">
					<button
						type="button"
						className="intake-review__btn intake-review__btn--approve"
						onClick={() => handleAction('approve')}
						disabled={actionLoading !== '' || !editable || dirty || editing}
					>
						{actionLoading === 'approve' ? 'Aprobando...' : 'Aprobar captura'}
					</button>
					<button
						type="button"
						className="intake-review__btn intake-review__btn--changes"
						onClick={() => handleAction('request_changes')}
						disabled={actionLoading !== '' || !editable || dirty || editing}
					>
						{actionLoading === 'request_changes' ? 'Enviando...' : 'Solicitar cambios'}
					</button>
				</div>
			</div>
		</div>
	);
};

export default SubmissionReview;
