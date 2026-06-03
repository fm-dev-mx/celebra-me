import type { InvitationEditorContextDTO } from '@/lib/dashboard/dto/intake';

interface Props {
	context: InvitationEditorContextDTO;
	onReconcile: () => void;
	reconciling: boolean;
	onRestorePublished: () => void;
	restoring: boolean;
}

function formatPublicationDate(value: string): string {
	return new Intl.DateTimeFormat('es-MX', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(value));
}

export default function PublicationSection({
	context,
	onReconcile,
	reconciling,
	onRestorePublished,
	restoring,
}: Props) {
	return (
		<div className="invitation-editor__stack">
			<div className="invitation-editor__publication-meta">
				<p>
					<strong>Versión pública:</strong>{' '}
					{context.publication.version ?? 'Sin publicar'}
				</p>
				<p>
					<strong>Última publicación:</strong>{' '}
					{context.publication.publishedAt
						? formatPublicationDate(context.publication.publishedAt)
						: 'Aún no publicada'}
				</p>
			</div>
			{context.publication.hasPublishedContent && (
				<button
					type="button"
					className="invitation-editor__secondary-button"
					onClick={onRestorePublished}
					disabled={restoring}
				>
					{restoring ? 'Restaurando...' : 'Restaurar desde versión pública'}
				</button>
			)}
			{context.rsvpLink.status !== 'linked' && (
				<div className="invitation-editor__warning">
					<p>
						{context.rsvpLink.status === 'unlinked_slug_match'
							? 'Hay un evento RSVP con el mismo slug, pero todavía no está vinculado a esta invitación.'
							: 'No se encontró un evento RSVP vinculado. Se puede sincronizar si existe un evento con el mismo slug.'}
					</p>
					{context.rsvpLink.status === 'unlinked_slug_match' && (
						<button type="button" onClick={onReconcile} disabled={reconciling}>
							{reconciling ? 'Vinculando...' : 'Buscar y vincular evento RSVP'}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
