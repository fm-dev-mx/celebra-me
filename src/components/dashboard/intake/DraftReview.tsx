import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import DraftEditor from '@/components/dashboard/intake/DraftEditor';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { FieldRow } from '@/components/intake/shared/FieldRow';
import { VenueSection } from '@/components/intake/shared/VenueSection';
import {
	SECTION_LABELS,
	PHOTO_LABELS,
	HERO_FIELD_LABELS,
	FAMILY_FIELD_LABELS,
	RSVP_FIELD_LABELS,
	MUSIC_FIELD_LABELS,
	QUOTE_FIELD_LABELS,
	THANK_YOU_FIELD_LABELS,
} from '@/lib/intake/labels';

interface Props {
	projectId: string;
}

const DraftReview: FC<Props> = ({ projectId }) => {
	const { currentDraft, loading, loadDraft, publishDraft } = useInvitationAdmin();
	const [editing, setEditing] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [publishError, setPublishError] = useState('');

	useEffect(() => {
		void loadDraft(projectId);
	}, [projectId, loadDraft]);

	if (loading && !currentDraft) {
		return (
			<div className="intake-review">
				<header className="intake-review__header">
					<h2 className="intake-review__title">Borrador de invitacion</h2>
				</header>
				<p className="intake-review__loading">Cargando borrador...</p>
			</div>
		);
	}

	if (!currentDraft) {
		return (
			<div className="intake-review">
				<header className="intake-review__header">
					<h2 className="intake-review__title">Borrador de invitacion</h2>
				</header>
				<p className="intake-review__empty">
					Aun no se ha generado un borrador para esta invitacion.
				</p>
				<a href={`/dashboard/invitaciones/${projectId}`} className="intake-detail__back">
					&larr; Volver al proyecto
				</a>
			</div>
		);
	}

	const content = currentDraft.content ?? {};

	const heroContent = content.hero as Record<string, unknown> | undefined;
	const family = content.family as Record<string, unknown> | undefined;
	const location = content.location as Record<string, unknown> | undefined;
	const rsvp = content.rsvp as Record<string, unknown> | undefined;
	const music = content.music as Record<string, unknown> | undefined;
	const gifts = content.gifts as Record<string, unknown> | undefined;
	const quote = content.quote as Record<string, unknown> | undefined;
	const thankYou = content.thankYou as Record<string, unknown> | undefined;
	const photoNotes = content.photoNotes as Record<string, unknown> | undefined;

	if (editing) {
		return (
			<DraftEditor
				projectId={projectId}
				initialContent={currentDraft.content as DraftContent}
				onCancel={() => {
					setEditing(false);
					void loadDraft(projectId);
				}}
			/>
		);
	}

	return (
		<div className="intake-review">
			<header className="intake-review__header">
				<a href={`/dashboard/invitaciones/${projectId}`} className="intake-detail__back">
					&larr; Volver
				</a>
				<h2 className="intake-review__title">{SECTION_LABELS.Hero}</h2>
				<div className="intake-review__meta">
					<span className="intake-review__badge">Estado: {currentDraft.status}</span>
					<span className="intake-review__date">
						Generado: {new Date(currentDraft.createdAt).toLocaleString('es-MX')}
					</span>
				</div>
				{currentDraft.status === 'draft' && (
					<>
						<button
							type="button"
							className="intake-detail__generate-btn intake-editor__edit-btn"
							onClick={() => setEditing(true)}
						>
							Editar borrador
						</button>
						<button
							type="button"
							className="intake-review__btn intake-review__btn--approve"
							onClick={async () => {
								if (
									!window.confirm(
										'¿Publicar este borrador como invitacion final?',
									)
								)
									return;
								setPublishing(true);
								setPublishError('');
								try {
									await publishDraft(projectId);
									void loadDraft(projectId);
								} catch (err) {
									setPublishError(
										err instanceof Error ? err.message : 'Error al publicar.',
									);
								} finally {
									setPublishing(false);
								}
							}}
							disabled={publishing}
						>
							{publishing ? 'Publicando...' : 'Publicar borrador'}
						</button>
					</>
				)}
				{publishError && <p className="intake-review__error">{publishError}</p>}
			</header>

			{heroContent && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.Hero}</h3>
					<dl className="intake-review__fields">
						{Object.entries(HERO_FIELD_LABELS).map(([key, label]) => (
							<FieldRow key={key} label={label} value={heroContent[key]} />
						))}
					</dl>
					<dl className="intake-review__fields">
						<FieldRow label="Título" value={content.title} />
						<FieldRow label="Descripción" value={content.description} />
					</dl>
				</section>
			)}

			{family && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.family}</h3>
					<dl className="intake-review__fields">
						{Object.entries(FAMILY_FIELD_LABELS).map(([key, label]) => (
							<FieldRow key={key} label={label} value={family[key]} />
						))}
					</dl>
				</section>
			)}

			{location && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.location}</h3>
					<VenueSection
						title="Ceremonia"
						venue={location.ceremony as Record<string, unknown> | undefined}
					/>
					<VenueSection
						title="Recepción"
						venue={location.reception as Record<string, unknown> | undefined}
					/>
					<dl className="intake-review__fields">
						<FieldRow label="Código de vestimenta" value={location.dressCode} />
						<FieldRow
							label="Indicaciones adicionales"
							value={location.additionalIndications}
						/>
					</dl>
				</section>
			)}

			{rsvp && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.rsvp}</h3>
					<dl className="intake-review__fields">
						{Object.entries(RSVP_FIELD_LABELS).map(([key, label]) => (
							<FieldRow key={key} label={label} value={rsvp[key]} />
						))}
					</dl>
				</section>
			)}

			{music && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.music}</h3>
					<dl className="intake-review__fields">
						{Object.entries(MUSIC_FIELD_LABELS).map(([key, label]) => (
							<FieldRow key={key} label={label} value={music[key]} />
						))}
					</dl>
				</section>
			)}

			{gifts && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.gifts}</h3>
					<dl className="intake-review__fields">
						<FieldRow label="Título" value={gifts.title} />
						<FieldRow label="Subtítulo" value={gifts.subtitle} />
					</dl>
					{renderGiftItems(gifts.items as Array<Record<string, unknown>> | undefined)}
				</section>
			)}

			{quote && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.quote}</h3>
					<dl className="intake-review__fields">
						{Object.entries(QUOTE_FIELD_LABELS).map(([key, label]) => (
							<FieldRow key={key} label={label} value={quote[key]} />
						))}
					</dl>
					{thankYou && (
						<>
							<h4 className="intake-review__venue-title">Agradecimiento</h4>
							<dl className="intake-review__fields">
								{Object.entries(THANK_YOU_FIELD_LABELS).map(([key, label]) => (
									<FieldRow key={key} label={label} value={thankYou[key]} />
								))}
							</dl>
						</>
					)}
				</section>
			)}

			{photoNotes && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.photoNotes}</h3>
					<dl className="intake-review__fields">
						{Object.entries(PHOTO_LABELS).map(([key, label]) => (
							<FieldRow key={key} label={label} value={photoNotes[key]} />
						))}
					</dl>
				</section>
			)}
		</div>
	);
};

function renderGiftItems(items: Array<Record<string, unknown>> | undefined): React.ReactNode {
	if (!items || items.length === 0) return null;
	return (
		<ul className="intake-review__gift-list">
			{items.map((item, idx) => {
				const type = String(item.type ?? '');
				const title = String(item.title ?? '');
				const detail = item.bankName
					? `${item.bankName} — ${item.accountHolder ?? ''}`
					: item.url
						? String(item.url)
						: item.text
							? String(item.text)
							: '';
				return (
					<li key={idx} className="intake-review__gift-item">
						<strong>{title}</strong>
						{detail && <span> — {detail}</span>}
						{type && <span className="intake-review__gift-type"> ({type})</span>}
					</li>
				);
			})}
		</ul>
	);
}

export default DraftReview;
