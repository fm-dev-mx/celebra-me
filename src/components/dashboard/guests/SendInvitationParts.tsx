import React, { useLayoutEffect, useRef, useState } from 'react';
import { formatPhoneDisplay } from '@/components/dashboard/guests/guest-presenter';

interface SendGuestSummaryProps {
	name: string;
	peopleInput: string;
	phone: string;
	countryCode: string;
	onEdit: () => void;
}

/** Guest details in one line so review-and-send fits a phone screen; "Cambiar" opens the fields. */
export const SendGuestSummary: React.FC<SendGuestSummaryProps> = ({
	name,
	peopleInput,
	phone,
	countryCode,
	onEdit,
}) => {
	const people = parseInt(peopleInput, 10);
	const peopleLabel =
		Number.isFinite(people) && people > 0
			? `${people} ${people === 1 ? 'persona' : 'personas'}`
			: 'Sin personas';
	const phoneLabel = phone.trim()
		? `${countryCode} ${formatPhoneDisplay(phone)}`
		: 'Sin teléfono';

	return (
		<div className="send-invitation__summary">
			<div className="send-invitation__summary-text">
				<span className="send-invitation__summary-name">{name}</span>
				<span className="send-invitation__summary-meta">
					{peopleLabel} · {phoneLabel}
				</span>
			</div>
			<button
				type="button"
				className="send-invitation__summary-edit"
				aria-expanded={false}
				aria-controls="send-invitation-details"
				onClick={onEdit}
			>
				Cambiar
			</button>
		</div>
	);
};

interface SendMessagePreviewProps {
	message: string;
	onEdit: () => void;
}

/** Read-only message preview, clamped for long templates with an explicit "see all". */
export const SendMessagePreview: React.FC<SendMessagePreviewProps> = ({ message, onEdit }) => {
	const [expanded, setExpanded] = useState(false);
	const [overflows, setOverflows] = useState(false);
	const previewRef = useRef<HTMLPreElement>(null);

	// Re-measured on resize too: fonts and styles can land after the first layout.
	useLayoutEffect(() => {
		const preview = previewRef.current;
		if (!preview || expanded) return;
		const measure = () => setOverflows(preview.scrollHeight > preview.clientHeight + 1);
		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(preview);
		return () => observer.disconnect();
	}, [message, expanded]);

	return (
		<>
			<div className="send-invitation__preview-card">
				<pre
					ref={previewRef}
					className={`send-invitation__preview-text${expanded ? '' : ' send-invitation__preview-text--clamped'}`}
				>
					{message}
				</pre>
			</div>
			<div className="send-invitation__preview-actions">
				<button type="button" className="send-invitation__preview-action" onClick={onEdit}>
					Editar
				</button>
				{(overflows || expanded) && (
					<button
						type="button"
						className="send-invitation__preview-action"
						aria-expanded={expanded}
						onClick={() => setExpanded((open) => !open)}
					>
						{expanded ? 'Ver menos' : 'Ver mensaje completo'}
					</button>
				)}
			</div>
		</>
	);
};
