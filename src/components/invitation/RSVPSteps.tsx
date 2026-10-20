import { forwardRef, useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import {
	RsvpShell,
	RsvpVisibleHeader,
	SubmitButtonText,
	type RsvpFormViewProps,
} from '@/components/invitation/RSVPComponents';
import {
	AttendanceField,
	ConfirmedFields,
	NameField,
	PhoneField,
} from '@/components/invitation/RSVPFormFields';

/*
  RSVP `flow: 'steps'`: the same form, hook and submission as RsvpFormView, one question per step —
  the answer, then who comes (name, phone and party size when they apply), then a message and the
  send button. Choosing an answer moves on; "Continuar" checks only the fields of its step. Focus
  moves to each step's heading, and the step count is announced.
*/

type RsvpStep = 'attendance' | 'details' | 'message';

type RsvpStepsFormViewProps = RsvpFormViewProps & {
	/** Runs the form validation and returns the current errors by field. */
	onValidate: () => Record<string, string>;
};

const STEP_HEADINGS: Record<RsvpStep, string> = {
	attendance: 'Su respuesta',
	details: '¿Quiénes vienen?',
	message: 'Unas palabras',
};

type StepActionsProps = Pick<
	RsvpFormViewProps,
	'isSubmitting' | 'submitStatus' | 'buttonLabel' | 'attendanceStatus' | 'onCancelEdit'
> & {
	step: RsvpStep;
	onContinue: () => void;
	onBack: () => void;
};

function StepActions({
	step,
	isSubmitting,
	submitStatus,
	buttonLabel,
	attendanceStatus,
	onContinue,
	onBack,
	onCancelEdit,
}: StepActionsProps) {
	return (
		<div className="rsvp__actions rsvp-steps__actions">
			{step === 'details' && (
				<button type="button" className="rsvp__button" onClick={onContinue}>
					<span className="rsvp__button-text">Continuar</span>
				</button>
			)}
			{step === 'message' && (
				<button
					type="submit"
					disabled={isSubmitting}
					className={`rsvp__button rsvp__button--${submitStatus}`}
				>
					<span className="rsvp__button-text">
						<SubmitButtonText
							submitStatus={submitStatus}
							buttonLabel={buttonLabel}
							attendanceStatus={attendanceStatus}
						/>
					</span>
				</button>
			)}
			{step !== 'attendance' && (
				<button type="button" className="rsvp__cancel-link" onClick={onBack}>
					Atrás
				</button>
			)}
			{onCancelEdit && (
				<button type="button" className="rsvp__cancel-link" onClick={onCancelEdit}>
					Cancelar
				</button>
			)}
		</div>
	);
}

export const RsvpStepsFormView = forwardRef<HTMLElement, RsvpStepsFormViewProps>((props, ref) => {
	const {
		title,
		subcopy,
		variant,
		onFocusCapture,
		prefersReducedMotion,
		buttonLabel,
		isSubmitting,
		submitStatus,
		isDemoPreview,
		showCancelEdit,
		showIdentityFields,
		touched,
		errors,
		nameLocked,
		showPhoneField,
		attendanceStatus,
		supportsPlusOnes,
		notesLabel,
		onSubmit,
		onCancelEdit,
		onAttendanceChange,
		onBlur,
		onValidate,
	} = props;
	const confirmLabel = variant === 'reply-card' ? 'Con gusto asistiré' : 'Sí, asistiré';
	const declineLabel = variant === 'reply-card' ? 'Lamento no poder asistir' : 'No podré asistir';
	const [step, setStep] = useState<RsvpStep>('attendance');
	const headingRef = useRef<HTMLHeadingElement>(null);
	const movedRef = useRef(false);

	const hasDetailsFor = (status: RsvpFormViewProps['attendanceStatus']) =>
		!nameLocked || (status === 'confirmed' && supportsPlusOnes);
	// Before an answer the count assumes a yes, so it does not grow once the guest accepts.
	const steps: RsvpStep[] = hasDetailsFor(attendanceStatus ?? 'confirmed')
		? ['attendance', 'details', 'message']
		: ['attendance', 'message'];
	const stepIndex = Math.max(0, steps.indexOf(step));
	const headings: Record<RsvpStep, string> = {
		...STEP_HEADINGS,
		...(props.stepAttendance && { attendance: props.stepAttendance }),
		...(props.stepDetails && { details: props.stepDetails }),
	};
	const detailFields = [
		...(showIdentityFields ? ['name'] : []),
		...(showIdentityFields && showPhoneField ? ['phone'] : []),
		...(attendanceStatus === 'confirmed' && supportsPlusOnes ? ['guestCount'] : []),
	];

	const goTo = (next: RsvpStep) => {
		movedRef.current = true;
		setStep(next);
	};

	useEffect(() => {
		if (!movedRef.current) return;
		// After the new step paints, so the answer does not wait on a forced layout.
		const frame = requestAnimationFrame(() =>
			headingRef.current?.focus({ preventScroll: true }),
		);
		return () => cancelAnimationFrame(frame);
	}, [step]);

	const handleAttendance: RsvpFormViewProps['onAttendanceChange'] = (status) => {
		onAttendanceChange(status);
		goTo(hasDetailsFor(status) ? 'details' : 'message');
	};

	const handleContinue = () => {
		detailFields.forEach((field) => onBlur(field));
		const current = onValidate();
		if (detailFields.some((field) => current[field])) return;
		goTo('message');
	};

	// The hook validates everything again; a step that is not on screen cannot show its
	// errors, so the guest is taken back to it instead of submitting.
	const handleSubmit = (event: SyntheticEvent) => {
		const current = onValidate();
		if (current.attendance) {
			event.preventDefault();
			onBlur('attendance');
			goTo('attendance');
			return;
		}
		if (detailFields.some((field) => current[field])) {
			event.preventDefault();
			detailFields.forEach((field) => onBlur(field));
			goTo('details');
			return;
		}
		onSubmit(event);
	};

	const back = () => goTo(steps[Math.max(0, stepIndex - 1)]);

	return (
		<RsvpShell
			ref={ref}
			state="form"
			variant={variant}
			onFocusCapture={onFocusCapture}
			header={
				<RsvpVisibleHeader
					title={title}
					subcopy={subcopy}
					eyebrow="RSVP PRIVADO"
					variant={variant}
				/>
			}
			demoFooter={
				isDemoPreview ? (
					<p className="rsvp__demo-footer">
						Demo interactiva. No se enviará ninguna respuesta.
					</p>
				) : null
			}
		>
			<form
				onSubmit={handleSubmit}
				className="rsvp__form rsvp-steps"
				id="rsvp-form"
				data-step={step}
				data-step-index={stepIndex}
				data-step-count={steps.length}
			>
				<div className="rsvp-steps__progress">
					<span className="rsvp-steps__track" aria-hidden="true">
						<span className="rsvp-steps__lantern" />
					</span>
					<p className="rsvp-steps__count" aria-live="polite">
						Paso {stepIndex + 1} de {steps.length}
					</p>
				</div>
				<div className="rsvp-steps__panel" key={step}>
					<h3 className="rsvp-steps__heading" ref={headingRef} tabIndex={-1}>
						{step === 'message' ? notesLabel : headings[step]}
					</h3>
					{step === 'attendance' && (
						<AttendanceField
							touched={touched}
							errors={errors}
							attendanceLabel={props.attendanceLabel}
							attendanceStatus={attendanceStatus}
							attendanceRef={props.attendanceRef}
							prefersReducedMotion={prefersReducedMotion}
							onAttendanceChange={handleAttendance}
							onBlur={onBlur}
							confirmLabel={confirmLabel}
							declineLabel={declineLabel}
						/>
					)}
					{step === 'details' && (
						<>
							{showIdentityFields && (
								<div className="rsvp__grid">
									<NameField
										nameLocked={nameLocked}
										touched={touched}
										errors={errors}
										nameLabel={props.nameLabel}
										name={props.name}
										nameRef={props.nameRef}
										prefersReducedMotion={prefersReducedMotion}
										onNameChange={props.onNameChange}
										onBlur={onBlur}
									/>
									<PhoneField
										showPhoneField={showPhoneField}
										touched={touched}
										errors={errors}
										phoneLabel={props.phoneLabel}
										phone={props.phone}
										countryCode={props.countryCode}
										phoneRef={props.phoneRef}
										prefersReducedMotion={prefersReducedMotion}
										onPhoneChange={props.onPhoneChange}
										onCountryCodeChange={props.onCountryCodeChange}
										onBlur={onBlur}
									/>
								</div>
							)}
							<ConfirmedFields
								part="guests"
								attendanceStatus={attendanceStatus}
								prefersReducedMotion={prefersReducedMotion}
								supportsPlusOnes={supportsPlusOnes}
								touched={touched}
								errors={errors}
								guestCountLabel={props.guestCountLabel}
								effectiveGuestCap={props.effectiveGuestCap}
								guestCountRef={props.guestCountRef}
								attendeeCount={props.attendeeCount}
								notes={props.notes}
								notesLabel={notesLabel}
								notesPlaceholder={props.notesPlaceholder}
								guestHint={props.guestHint}
								onGuestCountChange={props.onGuestCountChange}
								onNotesChange={props.onNotesChange}
								onBlur={onBlur}
							/>
						</>
					)}
					{step === 'message' && (
						<ConfirmedFields
							part="notes"
							attendanceStatus={attendanceStatus}
							prefersReducedMotion={prefersReducedMotion}
							supportsPlusOnes={supportsPlusOnes}
							touched={touched}
							errors={errors}
							guestCountLabel={props.guestCountLabel}
							effectiveGuestCap={props.effectiveGuestCap}
							guestCountRef={props.guestCountRef}
							attendeeCount={props.attendeeCount}
							notes={props.notes}
							notesLabel={notesLabel}
							notesPlaceholder={props.notesPlaceholder}
							onGuestCountChange={props.onGuestCountChange}
							onNotesChange={props.onNotesChange}
							onBlur={onBlur}
						/>
					)}
				</div>
				<div aria-live="polite" aria-atomic="true" className="rsvp__error-region">
					{errors.global && (
						<p className="rsvp__error" role="alert">
							{errors.global}
						</p>
					)}
				</div>
				<StepActions
					step={step}
					isSubmitting={isSubmitting}
					submitStatus={submitStatus}
					buttonLabel={buttonLabel}
					attendanceStatus={attendanceStatus}
					onContinue={handleContinue}
					onBack={back}
					onCancelEdit={showCancelEdit ? onCancelEdit : undefined}
				/>
			</form>
		</RsvpShell>
	);
});

RsvpStepsFormView.displayName = 'RsvpStepsFormView';
