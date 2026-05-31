import type { FC } from 'react';
import type { IntakeSubmissionStatus } from '@/lib/intake/types';
import type { IntakeSubmissionDTO } from '@/lib/dashboard/dto/intake';
import { SUBMISSION_STATUS_LABELS } from '@/lib/intake/labels';

interface Props {
	invitationId: string;
	submission: IntakeSubmissionDTO;
}

const SubmissionSection: FC<Props> = ({ invitationId, submission }) => {
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
					href={`/dashboard/invitaciones/${invitationId}/review`}
					className="intake-detail__review-link"
				>
					Revisar captura
				</a>
			)}
		</section>
	);
};

export default SubmissionSection;
