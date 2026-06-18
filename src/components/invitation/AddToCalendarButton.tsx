import { useEffect, useId, useRef, useState } from 'react';
import type { CalendarEventInput } from '@/lib/calendar/types';
import { generateIcsString } from '@/lib/calendar/ics';
import { downloadIcsFile } from '@/lib/calendar/download-calendar-file';
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl } from '@/lib/calendar/provider-urls';
import { CalendarIcon } from '@/components/common/icons/invitation/Calendar';

interface AddToCalendarButtonProps {
	eventData: CalendarEventInput | null;
}

export default function AddToCalendarButton({ eventData }: AddToCalendarButtonProps) {
	const [isOpen, setIsOpen] = useState(false);
	const popoverId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		function handlePointerDown(event: PointerEvent): void {
			const target = event.target;
			if (!(target instanceof Node) || rootRef.current?.contains(target)) return;
			setIsOpen(false);
		}

		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key !== 'Escape') return;
			setIsOpen(false);
			triggerRef.current?.focus();
		}

		document.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isOpen]);

	const handleDownload = () => {
		if (!eventData) return;
		const icsContent = generateIcsString(eventData);
		downloadIcsFile(icsContent, eventData.fileName);
		setIsOpen(false);
		triggerRef.current?.focus();
	};

	if (!eventData) return null;

	return (
		<div className="rsvp__calendar" ref={rootRef}>
			<button
				ref={triggerRef}
				type="button"
				className="rsvp__button rsvp__button--calendar"
				onClick={() => setIsOpen((current) => !current)}
				aria-label="Agregar al calendario"
				aria-expanded={isOpen}
				aria-controls={popoverId}
			>
				<CalendarIcon size={18} />
				<span>Agregar al calendario</span>
			</button>
			{isOpen && (
				<div className="rsvp__calendar-popover" id={popoverId}>
					<a
						className="rsvp__calendar-option"
						href={buildGoogleCalendarUrl(eventData)}
						target="_blank"
						rel="noopener noreferrer"
						onClick={() => setIsOpen(false)}
					>
						Google Calendar
					</a>
					<button
						type="button"
						className="rsvp__calendar-option"
						onClick={handleDownload}
					>
						Apple Calendar (.ics)
					</button>
					<a
						className="rsvp__calendar-option"
						href={buildOutlookCalendarUrl(eventData)}
						target="_blank"
						rel="noopener noreferrer"
						onClick={() => setIsOpen(false)}
					>
						Outlook
					</a>
				</div>
			)}
		</div>
	);
}
