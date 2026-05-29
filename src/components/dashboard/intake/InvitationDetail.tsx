import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import BlockSelector from '@/components/dashboard/intake/BlockSelector';
import IntakeLinkPanel from '@/components/dashboard/intake/IntakeLinkPanel';
import type { IntakeBlockType } from '@/lib/intake/types';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';

interface Props {
	projectId: string;
}

const STATUS_LABELS: Record<string, string> = {
	draft: 'Borrador',
	waiting_for_client: 'Esperando cliente',
	client_submitted: 'Captura recibida',
	in_review: 'En revision',
	in_production: 'En produccion',
	preview_sent: 'Vista previa enviada',
	approved: 'Aprobado',
	published: 'Publicado',
	archived: 'Archivado',
};

const InvitationDetail: FC<Props> = ({ projectId }) => {
	const {
		loading,
		error,
		currentProject,
		currentRequest,
		currentSubmission,
		rawToken,
		setRawToken,
		loadProjectDetail,
		updateProject,
		createIntakeRequest,
		regenerateToken,
	} = useInvitationAdmin();

	const [selectedBlocks, setSelectedBlocks] = useState<IntakeBlockType[]>([]);
	const [creatingRequest, setCreatingRequest] = useState(false);
	const [regenerating, setRegenerating] = useState(false);
	const [actionError, setActionError] = useState('');
	const [actionSuccess, setActionSuccess] = useState('');

	useEffect(() => {
		void loadProjectDetail(projectId);
	}, [projectId, loadProjectDetail]);

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
			const result = await createIntakeRequest(projectId, {
				enabledBlocks: selectedBlocks,
			});
			setRawToken(result.rawToken);
			setActionSuccess('Enlace de captura generado exitosamente.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al generar el enlace.');
		} finally {
			setCreatingRequest(false);
		}
	};

	const handleRegenerate = async () => {
		if (!window.confirm('Esto invalidara el enlace anterior. Continuar?')) return;

		setRegenerating(true);
		setActionError('');
		setActionSuccess('');

		try {
			const result = await regenerateToken(projectId);
			setRawToken(result.rawToken);
			setActionSuccess('Token regenerado. El enlace anterior ya no funciona.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al regenerar el token.');
		} finally {
			setRegenerating(false);
		}
	};

	const handleTogglePhotos = async () => {
		if (!currentProject) return;
		try {
			await updateProject(projectId, {
				photosReceived: !currentProject.photosReceived,
			});
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
						{STATUS_LABELS[currentProject.status] ?? currentProject.status}
					</span>
					<span className="intake-detail__type">{currentProject.eventType}</span>
					{preset && <span className="intake-detail__demo">{preset.displayName}</span>}
				</div>
			</header>

			<section className="intake-detail__section">
				<h3 className="intake-detail__section-title">Informacion del cliente</h3>
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
								{currentProject.photosReceived ? 'Si' : 'No'}
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
					projectId={projectId}
					request={currentRequest}
					rawToken={rawToken}
					onRegenerate={handleRegenerate}
					regenerating={regenerating}
				/>
			</section>

			{currentSubmission && (
				<section className="intake-detail__section">
					<h3 className="intake-detail__section-title">Captura del cliente</h3>
					<div className="intake-detail__submission-info">
						<span>Estado: {currentSubmission.status}</span>
						{currentSubmission.submittedAt && (
							<span>
								Enviada:{' '}
								{new Date(currentSubmission.submittedAt).toLocaleString('es-MX')}
							</span>
						)}
					</div>
					<a
						href={`/dashboard/invitaciones/${projectId}/review`}
						className="intake-detail__review-link"
					>
						Revisar captura
					</a>
				</section>
			)}

			{actionError && <p className="intake-detail__error">{actionError}</p>}
			{actionSuccess && <p className="intake-detail__success">{actionSuccess}</p>}
		</div>
	);
};

export default InvitationDetail;
