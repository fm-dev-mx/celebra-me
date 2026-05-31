import type { FC } from 'react';
import { useState } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';

interface Props {
	invitationId: string;
}

const DraftSection: FC<Props> = ({ invitationId }) => {
	const { currentDraft, generateDraft, createDraftRevision } = useInvitationAdmin();
	const [generating, setGenerating] = useState(false);
	const [revising, setRevising] = useState(false);
	const [actionError, setActionError] = useState('');
	const [actionSuccess, setActionSuccess] = useState('');

	const handleGenerateDraft = async () => {
		if (
			currentDraft &&
			!window.confirm(
				'Esto reemplazará el contenido editable con los datos base actuales. ¿Continuar?',
			)
		)
			return;
		setGenerating(true);
		setActionError('');
		setActionSuccess('');

		try {
			await generateDraft(invitationId);
			setActionSuccess('Borrador de invitación generado exitosamente.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al generar el borrador.');
		} finally {
			setGenerating(false);
		}
	};

	const handleCreateRevision = async () => {
		setRevising(true);
		setActionError('');
		setActionSuccess('');
		try {
			await createDraftRevision(invitationId);
			setActionSuccess('Nueva revisión editable creada exitosamente.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al crear la revisión.');
		} finally {
			setRevising(false);
		}
	};

	return (
		<section className="intake-detail__section">
			<h3 className="intake-detail__section-title">Contenido de la invitación</h3>
			{currentDraft ? (
				<div className="intake-detail__draft-info">
					<span>Estado: {currentDraft.status}</span>
					<span>
						Generado: {new Date(currentDraft.createdAt).toLocaleString('es-MX')}
					</span>
					<div className="intake-detail__draft-actions">
						<a
							href={`/dashboard/invitaciones/${invitationId}/draft`}
							className="intake-detail__review-link"
						>
							Revisar contenido
						</a>
						<a
							href={`/dashboard/invitaciones/${invitationId}/preview`}
							className="intake-detail__review-link"
							target="_blank"
							rel="noopener noreferrer"
						>
							Vista previa
						</a>
						{currentDraft.status === 'draft' ? (
							<button
								type="button"
								className="intake-detail__generate-btn"
								onClick={handleGenerateDraft}
								disabled={generating}
							>
								{generating
									? 'Reemplazando...'
									: 'Reemplazar contenido con datos base'}
							</button>
						) : (
							<button
								type="button"
								className="intake-detail__generate-btn"
								onClick={handleCreateRevision}
								disabled={revising}
							>
								{revising ? 'Creando...' : 'Crear nueva revisión'}
							</button>
						)}
					</div>
				</div>
			) : (
				<button
					type="button"
					className="intake-detail__generate-btn"
					onClick={handleGenerateDraft}
					disabled={generating}
				>
					{generating ? 'Generando...' : 'Crear contenido desde datos base'}
				</button>
			)}
			{actionError && <p className="intake-detail__error">{actionError}</p>}
			{actionSuccess && <p className="intake-detail__success">{actionSuccess}</p>}
		</section>
	);
};

export default DraftSection;
