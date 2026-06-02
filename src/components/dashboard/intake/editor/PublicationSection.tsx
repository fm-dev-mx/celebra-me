import type { InvitationEditorContextDTO } from '@/lib/dashboard/dto/intake';
import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';
import { moveArrayItem } from '@/lib/intake/utils';

interface Props {
	context: InvitationEditorContextDTO;
	sectionOrder: NonNullable<InvitationEditorContextDTO['content']['sectionOrder']>;
	onChange: (
		sectionOrder: NonNullable<InvitationEditorContextDTO['content']['sectionOrder']>,
	) => void;
	onReconcile: () => void;
	reconciling: boolean;
	onRestorePublished: () => void;
	restoring: boolean;
}

const SECTION_LABELS: Record<(typeof INVITATION_RENDER_SECTION_KEYS)[number], string> = {
	quote: 'Frase',
	countdown: 'Cuenta regresiva',
	location: 'Ubicaciones',
	family: 'Familia',
	itinerary: 'Programa',
	gallery: 'Galería',
	rsvp: 'Confirmación de asistencia',
	gifts: 'Mesa de regalos',
	thankYou: 'Agradecimiento',
	personalizedAccess: 'Acceso personalizado',
};

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
	sectionOrder,
	onChange,
	onReconcile,
	reconciling,
	onRestorePublished,
	restoring,
}: Props) {
	const move = (index: number, offset: -1 | 1) => {
		onChange(moveArrayItem(sectionOrder, index, offset));
	};

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
			<div>
				<h4>Orden de secciones públicas</h4>
				<div className="invitation-editor__stack">
					{sectionOrder.map((section, index) => (
						<div className="invitation-editor__order-row" key={section}>
							<span>
								{index + 1}. {SECTION_LABELS[section]}
							</span>
							<div className="invitation-editor__reorder">
								<button
									type="button"
									onClick={() => move(index, -1)}
									disabled={index === 0}
								>
									Subir
								</button>
								<button
									type="button"
									onClick={() => move(index, 1)}
									disabled={index === sectionOrder.length - 1}
								>
									Bajar
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
