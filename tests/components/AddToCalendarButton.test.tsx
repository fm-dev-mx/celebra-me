import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';
import AddToCalendarButton from '@/components/invitation/AddToCalendarButton';
import type { CalendarEventInput } from '@/lib/calendar/types';
import { generateIcsString } from '@/lib/calendar/ics';
import { downloadIcsFile } from '@/lib/calendar/download-calendar-file';

jest.mock('@/lib/calendar/ics', () => ({
	generateIcsString: jest.fn(() => 'BEGIN:VCALENDAR\nEND:VCALENDAR'),
}));

jest.mock('@/lib/calendar/download-calendar-file', () => ({
	downloadIcsFile: jest.fn(),
}));

describe('AddToCalendarButton', () => {
	const validEventData: CalendarEventInput = {
		title: 'Test Event',
		startsAt: '2026-12-12T18:00:00.000Z',
		fileName: 'test-event',
	};

	it('renders a button with "Agregar al calendario" when eventData is provided', () => {
		render(<AddToCalendarButton eventData={validEventData} />);
		expect(screen.getByText('Agregar al calendario')).toBeInTheDocument();
	});

	it('renders a button element', () => {
		render(<AddToCalendarButton eventData={validEventData} />);
		expect(screen.getByRole('button')).toBeInTheDocument();
	});

	it('does not render anything when eventData is null', () => {
		const { container } = render(<AddToCalendarButton eventData={null} />);
		expect(container.firstChild).toBeNull();
	});

	it('has an accessible label', () => {
		render(<AddToCalendarButton eventData={validEventData} />);
		expect(screen.getByLabelText('Agregar al calendario')).toBeInTheDocument();
	});

	it('calls generateIcsString and downloadIcsFile on click', () => {
		render(<AddToCalendarButton eventData={validEventData} />);
		fireEvent.click(screen.getByRole('button'));

		expect(jest.mocked(generateIcsString)).toHaveBeenCalledWith(validEventData);
		expect(jest.mocked(downloadIcsFile)).toHaveBeenCalledWith(
			'BEGIN:VCALENDAR\nEND:VCALENDAR',
			validEventData.fileName,
		);
	});
});
