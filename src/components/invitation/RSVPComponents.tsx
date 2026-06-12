import { motion } from 'framer-motion';
import { forwardRef } from 'react';
import type { FocusEventHandler, ReactNode, RefObject, SyntheticEvent } from 'react';
import {
	interpolateRsvpMessage,
	RSVP_DEFAULT_RESPONSE_MESSAGES,
	type AttendanceStatus,
	type RsvpResponseMessages,
} from '@/components/invitation/rsvp-logic';
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
	getDefaultRsvpSubcopy,
} from '@/components/invitation/rsvp-logic';
export type { WhatsAppConfig, AttendanceStatus } from '@/components/invitation/rsvp-logic';

// --- Sub-components ---

type RsvpShellState = 'form' | 'locked' | 'confirmed' | 'declined';

const RsvpShell = forwardRef<
	HTMLElement,
	{
		state: RsvpShellState;
		variant?: string;
		onFocusCapture?: FocusEventHandler<HTMLElement>;
		header: ReactNode;
		children: ReactNode;
		demoFooter?: ReactNode;
	}
>(function RsvpShell({ state, variant, onFocusCapture, header, children, demoFooter }, ref) {
	return (
		<section id="rsvp" ref={ref} className="rsvp-section" onFocusCapture={onFocusCapture}>
			<div className="rsvp" data-variant={variant} data-state={state}>
				<header className="rsvp__header">{header}</header>
				{children}
				{demoFooter}
			</div>
		</section>
	);
});

function RsvpVisibleHeader({
	title,
	subcopy,
	eyebrow,
}: {
	title: string;
	subcopy?: string;
	eyebrow: string;
}) {
	return (
		<>
			<p className="rsvp__eyebrow">{eyebrow}</p>
			<span className="rsvp__separator" aria-hidden="true">
				◆
			</span>
			<h2 className="rsvp__title">{title}</h2>
			{subcopy !== undefined && <p className="rsvp__subcopy">{subcopy}</p>}
		</>
	);
}

function RsvpStatusHeader({ title }: { title: string }) {
	return <h2 className="sr-only">{title}</h2>;
}

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
	if (submitStatus === 'success') return '!Confirmado!';
	if (attendanceStatus === 'declined') return 'ENVIAR RESPUESTA';
	return buttonLabel;
}

export function LockedPreview({ title, variant }: { title: string; variant?: string }) {
	return (
		<RsvpShell
			state="locked"
			variant={variant}
			header={<RsvpVisibleHeader title={title} eyebrow="RSVP" />}
		>
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
		</RsvpShell>
	);
}

function resolveGreetingMessages(
	attendanceStatus: AttendanceStatus,
	responseMessages: RsvpResponseMessages | undefined,
	name: string,
	celebrantName?: string,
): { title: string; subtitle: string } {
	const isConfirmed = attendanceStatus === 'confirmed';
	const vars = { guestName: name, celebrantName };
	const statusKey = isConfirmed ? 'confirmed' : 'declined';
	const defaults = RSVP_DEFAULT_RESPONSE_MESSAGES[statusKey];
	const custom = responseMessages?.[statusKey];

	return {
		title: interpolateRsvpMessage(custom?.title ?? defaults.title, vars),
		subtitle: interpolateRsvpMessage(custom?.subtitle ?? defaults.subtitle, vars),
	};
}

export const SubmittedState = forwardRef<
	HTMLDivElement,
	{
		title: string;
		variant?: string;
		onFocusCapture?: React.FocusEventHandler<HTMLElement>;
		name: string;
		attendanceStatus: AttendanceStatus;
		confirmationMessage: string;
		celebrantName?: string;
		showWhatsAppCta: boolean;
		whatsAppUrl: string;
		onWhatsAppClick: () => void;
		responseMessages?: RsvpResponseMessages;
	}
>((props, ref) => {
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
		onFocusCapture,
		responseMessages,
	} = props;

	const isConfirmed = attendanceStatus === 'confirmed';
	const { title: greetingTitle, subtitle: greetingSubtitle } = resolveGreetingMessages(
		attendanceStatus,
		responseMessages,
		name,
		celebrantName,
	);

	return (
		<RsvpShell
			state={isConfirmed ? 'confirmed' : 'declined'}
			variant={variant}
			onFocusCapture={onFocusCapture}
			header={<RsvpStatusHeader title={title} />}
		>
			<div
				className="rsvp__status rsvp__greeting"
				ref={ref}
				tabIndex={-1}
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				<div className="rsvp__greeting-icon">
					{isConfirmed ? <CheckSealIcon size={64} /> : <HeartbreakIcon size={64} />}
				</div>
				<h2 className="rsvp__greeting-message">{greetingTitle}</h2>
				{isConfirmed && (
					<p className="rsvp__greeting-message-body">{confirmationMessage}</p>
				)}

				<p className="rsvp__greeting-submessage">{greetingSubtitle}</p>

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
		</RsvpShell>
	);
});

SubmittedState.displayName = 'SubmittedState';

interface RsvpFormViewProps {
	title: string;
	subcopy: string;
	variant?: string;
	onFocusCapture?: FocusEventHandler<HTMLElement>;
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
}

export const RsvpFormView = forwardRef<HTMLElement, RsvpFormViewProps>((props, ref) => {
	const {
		title,
		subcopy,
		variant,
		onFocusCapture,
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
		<RsvpShell
			ref={ref}
			state="form"
			variant={variant}
			onFocusCapture={onFocusCapture}
			header={<RsvpVisibleHeader title={title} subcopy={subcopy} eyebrow={eyebrow} />}
			demoFooter={
				isDemoPreview ? (
					<p className="rsvp__demo-footer">
						Demo interactiva. No se enviará ninguna respuesta
					</p>
				) : null
			}
		>
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
				{attendanceStatus !== null && (
					<motion.div
						className="rsvp__actions"
						initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
					>
						<motion.button
							type="submit"
							disabled={isSubmitting}
							className={`rsvp__button rsvp__button--${submitStatus}`}
							initial={prefersReducedMotion ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
						>
							<span className="rsvp__button-text">
								<SubmitButtonText
									submitStatus={submitStatus}
									buttonLabel={buttonLabel}
									attendanceStatus={attendanceStatus}
								/>
							</span>
						</motion.button>
					</motion.div>
				)}
			</form>
		</RsvpShell>
	);
});

RsvpFormView.displayName = 'RsvpFormView';
