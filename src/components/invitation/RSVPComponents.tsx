import { motion } from 'framer-motion';
import type { RefObject, SyntheticEvent } from 'react';
import { type AttendanceStatus } from '@/components/invitation/rsvp-logic';
import {
	AttendanceField,
	ConfirmedFields,
	NameField,
	PhoneField,
} from '@/components/invitation/RSVPFormFields';
import { CheckSealIcon } from '@/components/common/icons/invitation/CheckSeal';
import { HeartbreakIcon } from '@/components/common/icons/invitation/Heartbreak';

export {
	buildWhatsAppUrl,
	resolveLabels,
	normalizeGuestCount,
} from '@/components/invitation/rsvp-logic';
export type { WhatsAppConfig, AttendanceStatus } from '@/components/invitation/rsvp-logic';

// --- Sub-components ---

export function SubmitButtonText({
	submitStatus,
	buttonLabel,
	attendanceStatus,
}: {
	submitStatus: 'idle' | 'loading' | 'success' | 'error';
	buttonLabel: string;
	attendanceStatus?: 'confirmed' | 'declined' | null;
}) {
	if (submitStatus === 'loading') return 'Enviando...';
	if (submitStatus === 'success') return '\u00a1Confirmado!';
	if (submitStatus === 'error') return 'Confirmar asistencia';
	if (attendanceStatus === 'declined') return 'ENVIAR RESPUESTA';
	return buttonLabel;
}

export function LockedPreview({ title, variant }: { title: string; variant?: string }) {
	return (
		<section id="rsvp" className="rsvp rsvp--locked-preview" data-variant={variant}>
			<h2 className="rsvp__title">{title}</h2>
			<div className="rsvp__locked-card" role="status" aria-live="polite">
				<p className="rsvp__locked-eyebrow">RSVP</p>
				<p className="rsvp__locked-message">
					Las reservas para este evento se gestionan de forma personalizada.
				</p>
				<p className="rsvp__locked-detail">
					Si recibiste tu invitación directa, utiliza el enlace exclusivo que te fue
					compartido.
				</p>
			</div>
		</section>
	);
}

export function SubmittedState(props: {
	title: string;
	variant?: string;
	name: string;
	attendanceStatus: AttendanceStatus;
	confirmationMessage: string;
	celebrantName?: string;
	showWhatsAppCta: boolean;
	whatsAppUrl: string;
	onWhatsAppClick: () => void;
	confirmedMessage?: string;
	declinedMessage?: string;
}) {
	const {
		title,
		variant,
		name,
		attendanceStatus,
		confirmationMessage,
		celebrantName,
		showWhatsAppCta,
		whatsAppUrl,
		onWhatsAppClick,
		confirmedMessage = '¡Gracias por acompañarnos,',
		declinedMessage = 'Sentimos mucho que no puedas acompañarnos.',
	} = props;

	return (
		<section id="rsvp" className="rsvp" data-variant={variant}>
			<h2 className="sr-only">{title}</h2>
			<div className="rsvp__greeting">
				<div className="rsvp__greeting-icon">
					{attendanceStatus === 'confirmed' ? (
						<CheckSealIcon size={64} />
					) : (
						<HeartbreakIcon size={64} />
					)}
				</div>
				<h2 className="rsvp__greeting-message">
					{attendanceStatus === 'confirmed' ? (
						<>
							{confirmedMessage}{' '}
							<strong className="rsvp__greeting-name">{name}</strong>!
							<br />
							{confirmationMessage}
						</>
					) : (
						<>
							{declinedMessage} <br />
							Gracias por avisarnos,{' '}
							<strong className="rsvp__greeting-name">{name}</strong>.
						</>
					)}
				</h2>

				<p className="rsvp__greeting-submessage">Tu confirmación ha sido registrada.</p>

				{showWhatsAppCta && (
					<div className="rsvp__contact-host">
						<p className="rsvp__contact-text">
							Comparte tu respuesta con{' '}
							<strong>{celebrantName || 'el festejado'}</strong>.
						</p>
						<a
							href={whatsAppUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="rsvp__whatsapp-cta"
							onClick={onWhatsAppClick}
							aria-label={`Enviar mensaje de WhatsApp a ${celebrantName || 'el festejado'}`}
						>
							<svg
								className="rsvp__whatsapp-icon"
								viewBox="0 0 24 24"
								fill="currentColor"
								width="20"
								height="20"
							>
								<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
							</svg>
							Enviar WhatsApp
						</a>
					</div>
				)}
			</div>
		</section>
	);
}

export function RsvpFormView(props: {
	title: string;
	variant?: string;
	eyebrow?: string;
	prefersReducedMotion: boolean;
	nameLocked: boolean;
	nameLabel: string;
	guestCountLabel: string;
	attendanceLabel: string;
	buttonLabel: string;
	phoneLabel: string;
	notesLabel: string;
	notesPlaceholder: string;
	name: string;
	phone: string;
	countryCode: string;
	showPhoneField: boolean;
	showIdentityFields: boolean;
	touched: Record<string, boolean>;
	errors: Record<string, string>;
	attendanceStatus: AttendanceStatus;
	supportsPlusOnes: boolean;
	effectiveGuestCap: number;
	attendeeCount: number | string;
	notes: string;
	isSubmitting: boolean;
	submitStatus: 'idle' | 'loading' | 'success' | 'error';
	nameRef: RefObject<HTMLInputElement | null>;
	phoneRef: RefObject<HTMLInputElement | null>;
	attendanceRef: RefObject<HTMLDivElement | null>;
	guestCountRef: RefObject<HTMLInputElement | null>;
	isDemoPreview?: boolean;
	onSubmit: (e: SyntheticEvent) => void;
	onNameChange: (value: string) => void;
	onPhoneChange: (value: string) => void;
	onCountryCodeChange: (value: string) => void;
	onAttendanceChange: (status: Exclude<AttendanceStatus, null>) => void;
	onGuestCountChange: (value: string) => void;
	onNotesChange: (value: string) => void;
	onBlur: (field: string) => void;
}) {
	const {
		title,
		variant,
		eyebrow = 'RSVP PRIVADO',
		prefersReducedMotion,
		buttonLabel,
		isSubmitting,
		submitStatus,
		isDemoPreview,
		showIdentityFields,
		touched,
		errors,
		nameLocked,
		nameLabel,
		name,
		nameRef,
		phoneLabel,
		phone,
		countryCode,
		showPhoneField,
		phoneRef,
		attendanceLabel,
		attendanceStatus,
		attendanceRef,
		guestCountLabel,
		guestCountRef,
		effectiveGuestCap,
		supportsPlusOnes,
		attendeeCount,
		notes,
		notesLabel,
		notesPlaceholder,
		onSubmit,
		onNameChange,
		onPhoneChange,
		onCountryCodeChange,
		onAttendanceChange,
		onGuestCountChange,
		onNotesChange,
		onBlur,
	} = props;

	const nameFieldProps = {
		nameLocked,
		touched,
		errors,
		nameLabel,
		name,
		nameRef,
		prefersReducedMotion,
		onNameChange,
		onBlur,
	};

	const phoneFieldProps = {
		showPhoneField,
		touched,
		errors,
		phoneLabel,
		phone,
		countryCode,
		phoneRef,
		prefersReducedMotion,
		onPhoneChange,
		onCountryCodeChange,
		onBlur,
	};

	const attendanceFieldProps = {
		touched,
		errors,
		attendanceLabel,
		attendanceStatus,
		attendanceRef,
		prefersReducedMotion,
		onAttendanceChange,
		onBlur,
	};

	const confirmedFieldsProps = {
		attendanceStatus,
		prefersReducedMotion,
		supportsPlusOnes,
		touched,
		errors,
		guestCountLabel,
		effectiveGuestCap,
		guestCountRef,
		attendeeCount,
		notes,
		notesLabel,
		notesPlaceholder,
		onGuestCountChange,
		onNotesChange,
		onBlur,
	};

	return (
		<section id="rsvp" className="rsvp" data-variant={variant}>
			<div className="rsvp__header">
				<p className="rsvp__eyebrow">{eyebrow}</p>
				<span className="rsvp__separator" aria-hidden="true">
					◆
				</span>
				<h2 className="rsvp__title">{title}</h2>
				<p className="rsvp__subcopy">
					Tu respuesta nos ayuda a preparar cada detalle de esta noche especial.
				</p>
			</div>
			<form onSubmit={onSubmit} className="rsvp__form" id="rsvp-form">
				{showIdentityFields && (
					<div className="rsvp__grid">
						<NameField {...nameFieldProps} />
						<PhoneField {...phoneFieldProps} />
					</div>
				)}
				<AttendanceField {...attendanceFieldProps} />
				<ConfirmedFields {...confirmedFieldsProps} />
				<div aria-live="polite" aria-atomic="true" className="rsvp__error-region">
					{errors.global && (
						<p className="rsvp__error" role="alert">
							{errors.global}
						</p>
					)}
				</div>
				<motion.button
					type="submit"
					disabled={isSubmitting}
					className={`rsvp__button rsvp__button--${submitStatus}`}
					initial={prefersReducedMotion ? false : { opacity: 0 }}
					whileInView={prefersReducedMotion ? undefined : { opacity: 1 }}
					viewport={prefersReducedMotion ? undefined : { once: true }}
					transition={prefersReducedMotion ? undefined : { delay: 0.2 }}
				>
					<span className="rsvp__button-text">
						<SubmitButtonText
							submitStatus={submitStatus}
							buttonLabel={buttonLabel}
							attendanceStatus={attendanceStatus}
						/>
					</span>
				</motion.button>
			</form>
			{isDemoPreview && (
				<p className="rsvp__demo-footer">
					Demo interactiva. No se enviará ninguna respuesta
				</p>
			)}
		</section>
	);
}
