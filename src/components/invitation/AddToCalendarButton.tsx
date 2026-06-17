import type { CalendarEventInput } from '@/lib/calendar/types';
import { generateIcsString } from '@/lib/calendar/ics';
import { downloadIcsFile } from '@/lib/calendar/download-calendar-file';
import { CalendarIcon } from '@/components/common/icons/invitation/Calendar';

interface AddToCalendarButtonProps {
	eventData: CalendarEventInput | null;
}

export default function AddToCalendarButton({ eventData }: AddToCalendarButtonProps) {
	if (!eventData) return null;

	const handleClick = () => {
		const icsContent = generateIcsString(eventData);
		downloadIcsFile(icsContent, eventData.fileName);
	};

	return (
		<button
			type="button"
			className="rsvp__button rsvp__button--calendar"
			onClick={handleClick}
			aria-label="Agregar al calendario"
		>
			<CalendarIcon size={18} />
			<span>Agregar al calendario</span>
		</button>
	);
}
