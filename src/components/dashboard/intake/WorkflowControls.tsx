import { useState } from 'react';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { InvitationDTO } from '@/lib/dashboard/dto/intake';
import type { WorkflowCommand } from '@/lib/intake/workflow';

export default function WorkflowControls({
	invitation,
	canReviewManually,
	onUpdated,
}: {
	invitation: InvitationDTO;
	canReviewManually: boolean;
	onUpdated: () => Promise<void>;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const workflow = invitation.workflow;
	if (!workflow) return <span>Seguimiento no disponible</span>;
	async function submit(command: WorkflowCommand) {
		setBusy(true);
		setError('');
		try {
			await adminApi.setInvitationWorkflow(invitation.id, command);
			await onUpdated();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'No se pudo guardar.');
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className="invitation-workflow">
			<span>Trabajo: {workflow.workStatus === 'completed' ? 'Terminada' : 'En proceso'}</span>
			<span>
				Última revisión manual:{' '}
				{workflow.ownerReviewedAt
					? new Date(workflow.ownerReviewedAt).toLocaleString('es-MX')
					: 'Sin registrar'}
			</span>
			{!invitation.archivedAt && (
				<>
					<button
						className="btn-secondary"
						type="button"
						disabled={busy}
						onClick={() =>
							void submit({
								action: 'set_work_status',
								workStatus:
									workflow.workStatus === 'completed'
										? 'in_progress'
										: 'completed',
								expectedUpdatedAt: invitation.updatedAt,
							})
						}
					>
						{workflow.workStatus === 'completed'
							? 'Marcar en proceso'
							: 'Marcar terminada'}
					</button>
					{canReviewManually && (
						<button
							className="btn-secondary"
							type="button"
							disabled={busy}
							onClick={() =>
								void submit({
									action: workflow.ownerReviewedAt
										? 'clear_review'
										: 'confirm_review',
									expectedUpdatedAt: invitation.updatedAt,
								})
							}
						>
							{workflow.ownerReviewedAt
								? 'Retirar revisión manual'
								: 'Confirmar mi revisión manual'}
						</button>
					)}
				</>
			)}
			{error && <span role="alert">{error}</span>}
		</div>
	);
}
