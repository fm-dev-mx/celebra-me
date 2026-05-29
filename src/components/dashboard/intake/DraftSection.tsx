import type { FC } from 'react';
import { useState } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';

interface Props {
	projectId: string;
}

const DraftSection: FC<Props> = ({ projectId }) => {
	const { currentDraft, generateDraft } = useInvitationAdmin();
	const [draftGenerating, setDraftGenerating] = useState(false);
	const [actionError, setActionError] = useState('');
	const [actionSuccess, setActionSuccess] = useState('');

	const handleGenerateDraft = async () => {
		setDraftGenerating(true);
		setActionError('');
		setActionSuccess('');

		try {
			await generateDraft(projectId);
			setActionSuccess('Borrador de invitacion generado exitosamente.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al generar el borrador.');
		} finally {
			setDraftGenerating(false);
		}
	};

	return (
		<section className="intake-detail__section">
			<h3 className="intake-detail__section-title">Borrador de invitacion</h3>
			{currentDraft ? (
				<div className="intake-detail__draft-info">
					<span>Estado: {currentDraft.status}</span>
					<span>
						Generado: {new Date(currentDraft.createdAt).toLocaleString('es-MX')}
					</span>
					<button
						type="button"
						className="intake-detail__generate-btn"
						onClick={handleGenerateDraft}
						disabled={draftGenerating}
					>
						{draftGenerating ? 'Regenerando...' : 'Regenerar borrador'}
					</button>
				</div>
			) : (
				<button
					type="button"
					className="intake-detail__generate-btn"
					onClick={handleGenerateDraft}
					disabled={draftGenerating}
				>
					{draftGenerating ? 'Generando...' : 'Generar borrador de invitacion'}
				</button>
			)}
			{actionError && <p className="intake-detail__error">{actionError}</p>}
			{actionSuccess && <p className="intake-detail__success">{actionSuccess}</p>}
		</section>
	);
};

export default DraftSection;
