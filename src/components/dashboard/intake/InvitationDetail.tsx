import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import BlockSelector from '@/components/dashboard/intake/BlockSelector';
import IntakeLinkPanel from '@/components/dashboard/intake/IntakeLinkPanel';
import DraftSection from '@/components/dashboard/intake/DraftSection';
import type { IntakeBlockType, IntakeSubmissionStatus } from '@/lib/intake/types';
import type { IntakeSubmissionDTO } from '@/lib/dashboard/dto/intake';
import { PROJECT_STATUS_LABELS, SUBMISSION_STATUS_LABELS } from '@/lib/intake/labels';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';

interface Props {
	projectId: string;
}

const InvitationDetail: FC<Props> = ({ projectId }) => {
	const {
		loading,
		error,
		currentProject,
		currentRequest,
		currentSubmission,
		loadProjectDetail,
		updateProject,
		createIntakeRequest,
		regenerateToken,
		loadDraft,
	} = useInvitationAdmin();

	const [selectedBlocks, setSelectedBlocks] = useState<IntakeBlockType[]>([]);
	const [creatingRequest, setCreatingRequest] = useState(false);
	const [regenerating, setRegenerating] = useState(false);
	const [actionError, setActionError] = useState('');
	const [actionSuccess, setActionSuccess] = useState('');

	useEffect(() => {
		void loadProjectDetail(projectId);
		void loadDraft(projectId);
	}, [projectId, loadProjectDetail, loadDraft]);

	useEffect(() => {
		if (currentRequest?.enabledBlocks) {
			setSelectedBlocks(currentRequest.enabledBlocks);
		}
	}, [currentRequest]);

	const handleCreateRequest = async () => {
		if (selectedBlocks.length === 0) {
			setActionError('Selecciona al menos un bloque de captura.');
			return;
		}

		setCreatingRequest(true);
		setActionError('');
		setActionSuccess('');

		try {
			await createIntakeRequest(projectId, {
				enabledBlocks: selectedBlocks,
			});
			setActionSuccess('Enlace de captura generado exitosamente.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al generar el enlace.');
		} finally {
			setCreatingRequest(false);
		}
	};

	const handleRegenerate = async () => {
		if (!window.confirm('Esto invalidará el enlace anterior. ¿Continuar?')) return;

		setRegenerating(true);
		setActionError('');
		setActionSuccess('');

		try {
			await regenerateToken(projectId);
			setActionSuccess('Token regenerado. El enlace anterior ya no funciona.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al regenerar el token.');
		} finally {
			setRegenerating(false);
		}
	};

	const handleTogglePhotos = async () => {
		if (!currentProject) return;
		setActionError('');
		setActionSuccess('');
		try {
			await updateProject(projectId, {
				photosReceived: !currentProject.photosReceived,
			});
			setActionSuccess(
				currentProject.photosReceived
					? 'Fotos marcadas como no recibidas.'
					: 'Fotos marcadas como recibidas.',
			);
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al actualizar.');
		}
	};

	if (loading) {
		return <div className="intake-detail__loading">Cargando...</div>;
	}

	if (error) {
		return <div className="intake-detail__error">{error}</div>;
	}

	if (!currentProject) {
		return <div className="intake-detail__empty">Proyecto no encontrado.</div>;
	}

	const preset = findDemoPreset(currentProject.baseDemoId);

	return (
		<div className="intake-detail">
			<header className="intake-detail__header">
				<div className="intake-detail__header-top">
					<a href="/dashboard/invitaciones" className="intake-detail__back">
						&larr; Volver
					</a>
				</div>
				<h2 className="intake-detail__title">{currentProject.title}</h2>
				<div className="intake-detail__meta">
					<span className="intake-detail__badge">
						{PROJECT_STATUS_LABELS[currentProject.status] ?? currentProject.status}
					</span>
					<span className="intake-detail__type">{currentProject.eventType}</span>
					{preset && <span className="intake-detail__demo">{preset.displayName}</span>}
				</div>
			</header>

			<section className="intake-detail__section">
				<h3 className="intake-detail__section-title">Información del cliente</h3>
				<dl className="intake-detail__info">
					<div className="intake-detail__info-row">
						<dt>Cliente</dt>
						<dd>{currentProject.clientName || '—'}</dd>
					</div>
					<div className="intake-detail__info-row">
						<dt>WhatsApp</dt>
						<dd>{currentProject.clientWhatsapp || '—'}</dd>
					</div>
					<div className="intake-detail__info-row">
						<dt>Correo</dt>
						<dd>{currentProject.clientEmail || '—'}</dd>
					</div>
					<div className="intake-detail__info-row">
						<dt>Fotos recibidas</dt>
						<dd>
							<button
								type="button"
								className="intake-detail__toggle"
								onClick={handleTogglePhotos}
							>
								{currentProject.photosReceived ? 'Sí' : 'No'}
							</button>
						</dd>
					</div>
				</dl>
			</section>

			<section className="intake-detail__section">
				<h3 className="intake-detail__section-title">Bloques de captura</h3>
				<BlockSelector
					eventType={currentProject.eventType}
					selectedBlocks={selectedBlocks}
					recommendedBlocks={preset?.recommendedBlocks}
					onChange={setSelectedBlocks}
				/>

				{!currentRequest && (
					<button
						type="button"
						className="intake-detail__generate-btn"
						onClick={handleCreateRequest}
						disabled={creatingRequest}
					>
						{creatingRequest ? 'Generando...' : 'Generar enlace de captura'}
					</button>
				)}
			</section>

			<section className="intake-detail__section">
				<h3 className="intake-detail__section-title">Enlace de captura</h3>
				<IntakeLinkPanel
					request={currentRequest}
					onRegenerate={handleRegenerate}
					regenerating={regenerating}
				/>
			</section>

			{currentSubmission && (
				<SubmissionSection projectId={projectId} submission={currentSubmission} />
			)}

			{currentSubmission?.status === 'approved' && <DraftSection projectId={projectId} />}

			{actionError && <p className="intake-detail__error">{actionError}</p>}
			{actionSuccess && <p className="intake-detail__success">{actionSuccess}</p>}
		</div>
	);
};

interface SubmissionSectionProps {
	projectId: string;
	submission: IntakeSubmissionDTO;
}

const SubmissionSection: FC<SubmissionSectionProps> = ({ projectId, submission }) => {
	const status = submission.status as IntakeSubmissionStatus;
	const showReview = status === 'submitted' || status === 'needs_changes';
	return (
		<section className="intake-detail__section">
			<h3 className="intake-detail__section-title">Captura del cliente</h3>
			<div className="intake-detail__submission-info">
				<span>Estado: {SUBMISSION_STATUS_LABELS[status] ?? status}</span>
				{submission.submittedAt && (
					<span>Enviada: {new Date(submission.submittedAt).toLocaleString('es-MX')}</span>
				)}
			</div>
			{status === 'in_progress' && (
				<p className="intake-detail__submission-hint">
					El cliente ha comenzado pero aún no ha enviado la captura.
				</p>
			)}
			{showReview && (
				<a
					href={`/dashboard/invitaciones/${projectId}/review`}
					className="intake-detail__review-link"
				>
					Revisar captura
				</a>
			)}
		</section>
	);
};

export default InvitationDetail;
