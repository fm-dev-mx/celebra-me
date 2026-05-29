import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import DraftEditor from '@/components/dashboard/intake/DraftEditor';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

interface Props {
	projectId: string;
}

interface FieldProps {
	label: string;
	value: unknown;
}

function fieldValue(value: unknown): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value === 'boolean') return value ? 'Sí' : 'No';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	return null;
}

const Field: FC<FieldProps> = ({ label, value }) => {
	const display = fieldValue(value);
	if (display === null) return null;
	return (
		<div className="intake-review__field">
			<dt className="intake-review__key">{label}</dt>
			<dd className="intake-review__value">{display}</dd>
		</div>
	);
};

function renderVenue(label: string, venue: Record<string, unknown> | undefined): React.ReactNode {
	if (!venue) return null;
	const entries = Object.entries(venue).filter(([, v]) => fieldValue(v) !== null);
	if (entries.length === 0) return null;

	return (
		<div key={label} className="intake-review__venue">
			<h4 className="intake-review__venue-title">{label}</h4>
			<dl className="intake-review__fields">
				{entries.map(([key, val]) => {
					const fieldLabels: Record<string, string> = {
						venueName: 'Nombre del lugar',
						address: 'Direccion',
						city: 'Ciudad',
						date: 'Fecha',
						time: 'Hora',
						mapUrl: 'Mapa',
					};
					return <Field key={key} label={fieldLabels[key] ?? key} value={val} />;
				})}
			</dl>
		</div>
	);
}

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

const SECTION_LABELS: Record<string, string> = {
	title: 'Datos principales / Hero',
	family: 'Familia',
	location: 'Fecha y ubicaciones',
	rsvp: 'Confirmacion de asistencia',
	music: 'Musica de fondo',
	gifts: 'Regalos',
	quote: 'Mensajes especiales',
	thankYou: 'Agradecimiento',
	photoNotes: 'Notas de fotografias',
};

const DraftReview: FC<Props> = ({ projectId }) => {
	const { currentDraft, loading, loadDraft } = useInvitationAdmin();
	const [editing, setEditing] = useState(false);

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

	const heroLabels: Record<string, string> = {
		name: 'Nombre del festejado',
		secondaryName: 'Segundo nombre',
		label: 'Titulo del evento',
		nickname: 'Apodo',
		date: 'Fecha del evento',
	};

	const familyLabels: Record<string, string> = {
		fatherName: 'Nombre del padre',
		fatherDeceased: 'Padre fallecido',
		motherName: 'Nombre de la madre',
		motherDeceased: 'Madre fallecida',
		spouseName: 'Nombre del conyuge',
		godparents: 'Padrinos',
		children: 'Hijos',
		sectionMessage: 'Mensaje familiar',
	};

	const rsvpLabels: Record<string, string> = {
		title: 'Titulo',
		guestCap: 'Acompanantes maximo',
		confirmationMessage: 'Mensaje de confirmacion',
		confirmationMode: 'Modo de confirmacion',
		whatsappPhone: 'WhatsApp',
		subcopy: 'Texto adicional',
	};

	const musicLabels: Record<string, string> = {
		url: 'URL de la cancion',
		title: 'Titulo de la cancion',
	};

	const photoLabels: Record<string, string> = {
		whatsappSent: 'Fotos enviadas por WhatsApp',
		heroPhoto: 'Foto principal',
		portraitPhoto: 'Retrato',
		galleryPhotos: 'Fotos de galeria',
		familyPhoto: 'Foto familiar',
		specialPhoto: 'Foto especial',
		generalNotes: 'Notas generales',
	};

	const quoteLabels: Record<string, string> = {
		text: 'Frase de apertura',
		author: 'Autor',
	};

	const thankYouLabels: Record<string, string> = {
		message: 'Mensaje de agradecimiento',
		closingName: 'Nombre de despedida',
	};

	if (editing) {
		return (
			<DraftEditor
				projectId={projectId}
				initialContent={currentDraft.content as DraftContent}
				onCancel={() => setEditing(false)}
				onSaved={() => {
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
				<h2 className="intake-review__title">{SECTION_LABELS.title}</h2>
				<div className="intake-review__meta">
					<span className="intake-review__badge">Estado: {currentDraft.status}</span>
					<span className="intake-review__date">
						Generado: {new Date(currentDraft.createdAt).toLocaleString('es-MX')}
					</span>
				</div>
				{currentDraft.status === 'draft' && (
					<button
						type="button"
						className="intake-detail__generate-btn intake-editor__edit-btn"
						onClick={() => setEditing(true)}
					>
						Editar borrador
					</button>
				)}
			</header>

			{/* Hero / Main data */}
			{heroContent && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.title}</h3>
					<dl className="intake-review__fields">
						{Object.entries(heroLabels).map(([key, label]) => (
							<Field key={key} label={label} value={heroContent[key]} />
						))}
					</dl>
					<dl className="intake-review__fields">
						<Field label="Titulo" value={content.title} />
						<Field label="Descripcion" value={content.description} />
					</dl>
				</section>
			)}

			{/* Family */}
			{family && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.family}</h3>
					<dl className="intake-review__fields">
						{Object.entries(familyLabels).map(([key, label]) => (
							<Field key={key} label={label} value={family[key]} />
						))}
					</dl>
				</section>
			)}

			{/* Location */}
			{location && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.location}</h3>
					{renderVenue(
						'Ceremonia',
						location.ceremony as Record<string, unknown> | undefined,
					)}
					{renderVenue(
						'Recepcion',
						location.reception as Record<string, unknown> | undefined,
					)}
					<dl className="intake-review__fields">
						<Field label="Codigo de vestimenta" value={location.dressCode} />
						<Field
							label="Indicaciones adicionales"
							value={location.additionalIndications}
						/>
					</dl>
				</section>
			)}

			{/* RSVP */}
			{rsvp && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.rsvp}</h3>
					<dl className="intake-review__fields">
						{Object.entries(rsvpLabels).map(([key, label]) => (
							<Field key={key} label={label} value={rsvp[key]} />
						))}
					</dl>
				</section>
			)}

			{/* Music */}
			{music && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.music}</h3>
					<dl className="intake-review__fields">
						{Object.entries(musicLabels).map(([key, label]) => (
							<Field key={key} label={label} value={music[key]} />
						))}
					</dl>
				</section>
			)}

			{/* Gifts */}
			{gifts && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.gifts}</h3>
					<dl className="intake-review__fields">
						<Field label="Titulo" value={gifts.title} />
						<Field label="Subtitulo" value={gifts.subtitle} />
					</dl>
					{renderGiftItems(gifts.items as Array<Record<string, unknown>> | undefined)}
				</section>
			)}

			{/* Quote */}
			{quote && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.quote}</h3>
					<dl className="intake-review__fields">
						{Object.entries(quoteLabels).map(([key, label]) => (
							<Field key={key} label={label} value={quote[key]} />
						))}
					</dl>
					{thankYou && (
						<>
							<h4 className="intake-review__venue-title">Agradecimiento</h4>
							<dl className="intake-review__fields">
								{Object.entries(thankYouLabels).map(([key, label]) => (
									<Field key={key} label={label} value={thankYou[key]} />
								))}
							</dl>
						</>
					)}
				</section>
			)}

			{/* Photo notes */}
			{photoNotes && (
				<section className="intake-review__section">
					<h3 className="intake-review__section-title">{SECTION_LABELS.photoNotes}</h3>
					<dl className="intake-review__fields">
						{Object.entries(photoLabels).map(([key, label]) => (
							<Field key={key} label={label} value={photoNotes[key]} />
						))}
					</dl>
				</section>
			)}
		</div>
	);
};

export default DraftReview;
