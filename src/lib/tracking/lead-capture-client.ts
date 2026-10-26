/**
 * Browser behaviour of the «Aparta su fecha» dialog (LeadCaptureDialog.astro).
 *
 * A click on a WhatsApp CTA marked `data-lead-capture` is caught before the click tracker sees it
 * and opens the dialog. The dialog's two exits are ordinary tracked WhatsApp links that copy the
 * CTA's tracking attributes, so a Contact is still counted once, from the exit the visitor took:
 * `<cta>__ask` for «Solo quiero preguntar», `<cta>__form` after the form.
 */
import { withWhatsAppText } from '@/lib/landing/vitrina';
import {
	getLeadCaptureContext,
	rememberWhatsAppLeadCode,
	trackLeadCaptureEvent,
} from '@/lib/tracking/client';
import {
	buildLeadCaptureWhatsAppMessage,
	isLeadEventDateInRange,
	LEAD_CAPTURE_EVENT_TYPE_VALUES,
	LEAD_CAPTURE_FORM_ID,
} from '@/lib/tracking/lead-capture';
import { rememberMetaPhoneMatchKey } from '@/lib/tracking/meta-pixel';

const COPIED_ATTRIBUTES = [
	'data-track-event',
	'data-track-section',
	'data-track-intent',
	'data-track-destination',
	'data-campaign-code',
	'data-package-interest',
	'data-package-name',
	'data-promo-code',
	'data-event-type',
	'data-track-value',
	'data-track-currency',
	'data-demo-slug',
	'data-preserve-message',
] as const;

const PHONE_DIGITS = /^(?:52|1)?\d{10}$/;

interface DialogElements {
	dialog: HTMLDialogElement;
	form: HTMLFormElement;
	ask: HTMLAnchorElement;
	continueLink: HTMLAnchorElement;
	submit: HTMLButtonElement;
	error: HTMLElement;
	success: HTMLElement;
	code: HTMLElement;
}

interface OpenState {
	trigger: HTMLAnchorElement;
	ctaId: string;
	sourceArea: string;
	openedAt: number;
	eventId: string;
	started: boolean;
}

function findElements(): DialogElements | null {
	const dialog = document.querySelector<HTMLDialogElement>('[data-lead-capture-dialog]');
	if (!dialog || typeof dialog.showModal !== 'function') return null;
	const form = dialog.querySelector<HTMLFormElement>('[data-lead-capture-form]');
	const ask = dialog.querySelector<HTMLAnchorElement>('[data-lead-capture-ask]');
	const continueLink = dialog.querySelector<HTMLAnchorElement>('[data-lead-capture-continue]');
	const submit = dialog.querySelector<HTMLButtonElement>('[data-lead-capture-submit]');
	const error = dialog.querySelector<HTMLElement>('[data-lead-capture-error]');
	const success = dialog.querySelector<HTMLElement>('[data-lead-capture-success]');
	const code = dialog.querySelector<HTMLElement>('[data-lead-capture-code]');
	if (!form || !ask || !continueLink || !submit || !error || !success || !code) return null;
	return { dialog, form, ask, continueLink, submit, error, success, code };
}

/** Copies the CTA's tracking attributes to an exit link and tags the exit in its CTA ID. */
function prepareExitLink(link: HTMLAnchorElement, state: OpenState, exit: 'ask' | 'form') {
	for (const name of COPIED_ATTRIBUTES) {
		const value = state.trigger.getAttribute(name);
		if (value === null) link.removeAttribute(name);
		else link.setAttribute(name, value);
	}
	link.dataset.trackCta = `${state.ctaId}__${exit}`;
	// The form's message already ends with the folio the click tracker must link to the lead.
	if (exit === 'form') delete link.dataset.preserveMessage;
	link.dataset.trackLabel = exit === 'ask' ? 'Solo quiero preguntar' : 'Aparta su fecha';
}

function toIsoDate(date: Date): string {
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 10);
}

function fieldError(form: HTMLFormElement, name: string, invalid: boolean): boolean {
	const field = form.elements.namedItem(name);
	if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return !invalid;
	field.setAttribute('aria-invalid', invalid ? 'true' : 'false');
	const message = document.getElementById(`${field.id}-error`);
	if (message) message.hidden = !invalid;
	return !invalid;
}

function readValue(form: HTMLFormElement, name: string): string {
	const field = form.elements.namedItem(name);
	return field instanceof HTMLInputElement || field instanceof HTMLSelectElement
		? field.value.trim()
		: '';
}

function validate(form: HTMLFormElement): boolean {
	const phoneDigits = readValue(form, 'phone').replace(/\D/g, '');
	const eventDate = readValue(form, 'eventDate');
	const checks = [
		fieldError(form, 'contactName', readValue(form, 'contactName').length < 2),
		fieldError(
			form,
			'eventType',
			!(LEAD_CAPTURE_EVENT_TYPE_VALUES as readonly string[]).includes(
				readValue(form, 'eventType'),
			),
		),
		fieldError(form, 'eventDate', !isLeadEventDateInRange(eventDate, new Date())),
		fieldError(form, 'phone', !PHONE_DIGITS.test(phoneDigits)),
	];
	const firstInvalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
	firstInvalid?.focus();
	return checks.every(Boolean);
}

function selectOption(select: HTMLSelectElement | null, value: string | undefined) {
	if (!select || !value) return;
	if ([...select.options].some((option) => option.value === value)) select.value = value;
}

export function initLeadCapture(): void {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initLeadCapture, { once: true });
		return;
	}
	if (document.body.dataset.leadCaptureBound === 'true') return;
	const elements = findElements();
	if (!elements) return;
	document.body.dataset.leadCaptureBound = 'true';
	const { dialog, form, ask, continueLink, submit, error, success, code } = elements;
	let state: OpenState | null = null;

	const dateInput = form.querySelector<HTMLInputElement>('input[name="eventDate"]');
	const demoSelect = form.querySelector<HTMLSelectElement>('select[name="demoSlug"]');
	const eventTypeSelect = form.querySelector<HTMLSelectElement>('select[name="eventType"]');

	const open = (trigger: HTMLAnchorElement) => {
		state = {
			trigger,
			ctaId: trigger.dataset.trackCta || 'whatsapp',
			sourceArea: trigger.dataset.trackSection || '',
			openedAt: Date.now(),
			eventId: crypto.randomUUID(),
			started: false,
		};
		ask.href = trigger.href;
		prepareExitLink(ask, state, 'ask');
		if (dateInput) {
			const today = new Date();
			dateInput.min = toIsoDate(today);
			dateInput.max = toIsoDate(new Date(today.getTime() + 3 * 365 * 86_400_000));
		}
		selectOption(eventTypeSelect, trigger.dataset.eventType);
		selectOption(demoSelect, trigger.dataset.leadCaptureDemo ?? trigger.dataset.demoSlug);
		form.hidden = false;
		success.hidden = true;
		error.hidden = true;
		dialog.showModal();
	};

	// Capture phase: runs before the click tracker on <body>, so the CTA itself counts nothing.
	document.addEventListener(
		'click',
		(event) => {
			if (event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const trigger =
				event.target instanceof Element
					? event.target.closest<HTMLAnchorElement>('a[data-lead-capture]')
					: null;
			if (!trigger || dialog.contains(trigger)) return;
			event.preventDefault();
			event.stopPropagation();
			open(trigger);
		},
		true,
	);

	dialog.querySelector('[data-lead-capture-close]')?.addEventListener('click', () => {
		dialog.close();
	});
	// A tap on the backdrop (outside the panel) closes the dialog.
	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) dialog.close();
	});
	ask.addEventListener('click', () => {
		// Let the tracked navigation start, then close the dialog behind it.
		setTimeout(() => dialog.close(), 0);
	});
	// Picking a demo first fills its event type when none is chosen yet.
	demoSelect?.addEventListener('change', () => {
		const demoEventType = demoSelect.selectedOptions[0]?.dataset.eventType;
		if (demoEventType && eventTypeSelect && !eventTypeSelect.value) {
			selectOption(eventTypeSelect, demoEventType);
		}
	});

	// A field marked invalid on submit clears its message as soon as the visitor edits it.
	const clearFieldError = (event: Event) => {
		const field = event.target;
		if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
		if (field.getAttribute('aria-invalid') !== 'true') return;
		fieldError(form, field.name, false);
	};
	form.addEventListener('input', clearFieldError);
	form.addEventListener('change', clearFieldError);

	form.addEventListener('input', () => {
		if (!state || state.started) return;
		state.started = true;
		trackLeadCaptureEvent('form_started', {
			form_id: LEAD_CAPTURE_FORM_ID,
			cta_id: state.ctaId,
			source_area: state.sourceArea,
		});
	});

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (!state || submit.disabled) return;
		error.hidden = true;
		if (!validate(form)) return;

		const current = state;
		const context = getLeadCaptureContext();
		const answers = {
			contactName: readValue(form, 'contactName'),
			eventType: readValue(form, 'eventType'),
			eventDate: readValue(form, 'eventDate'),
			celebrantNames: readValue(form, 'celebrantNames') || undefined,
			phone: readValue(form, 'phone'),
			demoSlug: readValue(form, 'demoSlug') || undefined,
		};
		submit.disabled = true;
		submit.setAttribute('aria-busy', 'true');
		try {
			const response = await fetch('/api/leads/capture', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...context,
					...answers,
					eventId: current.eventId,
					sourceArea: current.sourceArea || undefined,
					ctaId: current.ctaId,
					website: readValue(form, 'website'),
					elapsedMs: Date.now() - current.openedAt,
				}),
			});
			const body = (await response.json().catch(() => null)) as {
				data?: { leadCode?: string };
				error?: { message?: string };
			} | null;
			const leadCode = body?.data?.leadCode;
			if (!response.ok || !leadCode) {
				error.textContent =
					response.status === 429
						? 'Recibimos muchas solicitudes. Intente de nuevo en un minuto o use «Solo quiero preguntar».'
						: 'No pudimos guardar sus datos. Revise el formulario o use «Solo quiero preguntar».';
				error.hidden = false;
				return;
			}

			rememberWhatsAppLeadCode(leadCode);
			rememberMetaPhoneMatchKey(answers.phone);
			trackLeadCaptureEvent(
				'form_submitted',
				{
					form_id: LEAD_CAPTURE_FORM_ID,
					event_type: answers.eventType,
					demo_slug: answers.demoSlug ?? '',
					source_area: current.sourceArea,
					cta_id: current.ctaId,
				},
				{ eventId: current.eventId },
			);

			const demoName = answers.demoSlug
				? demoSelect?.selectedOptions[0]?.textContent?.trim()
				: undefined;
			const message = buildLeadCaptureWhatsAppMessage({ ...answers, demoName, leadCode });
			continueLink.href = withWhatsAppText(
				current.trigger.href,
				message,
				window.location.href,
			);
			prepareExitLink(continueLink, current, 'form');
			if (answers.demoSlug) continueLink.dataset.demoSlug = answers.demoSlug;
			continueLink.dataset.eventType = answers.eventType;
			code.textContent = leadCode;
			form.hidden = true;
			success.hidden = false;
			success.focus();
			// Same-tab navigation: a new tab opened after the request would be blocked as a popup.
			continueLink.click();
		} catch {
			error.textContent =
				'Sin conexión por ahora. Intente de nuevo o use «Solo quiero preguntar».';
			error.hidden = false;
		} finally {
			submit.disabled = false;
			submit.removeAttribute('aria-busy');
		}
	});
}
