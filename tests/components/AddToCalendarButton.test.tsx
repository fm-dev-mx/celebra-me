import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
		endsAt: '2026-12-12T22:00:00.000Z',
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

	it('opens provider options from the trigger button', async () => {
		const user = userEvent.setup();
		render(<AddToCalendarButton eventData={validEventData} />);

		const trigger = screen.getByRole('button', { name: /Agregar al calendario/i });
		expect(trigger).toHaveAttribute('aria-expanded', 'false');

		await user.click(trigger);

		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('link', { name: 'Google Calendar' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Apple Calendar (.ics)' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Outlook' })).toBeInTheDocument();
	});

	it('renders Google and Outlook provider links', async () => {
		const user = userEvent.setup();
		render(<AddToCalendarButton eventData={validEventData} />);

		await user.click(screen.getByRole('button', { name: /Agregar al calendario/i }));

		expect(screen.getByRole('link', { name: 'Google Calendar' })).toHaveAttribute(
			'href',
			expect.stringContaining('https://calendar.google.com/calendar/render'),
		);
		expect(screen.getByRole('link', { name: 'Outlook' })).toHaveAttribute(
			'href',
			expect.stringContaining('https://outlook.office.com/calendar/deeplink/compose'),
		);
	});

	it('downloads an .ics file for Apple Calendar', async () => {
		const user = userEvent.setup();
		render(<AddToCalendarButton eventData={validEventData} />);

		await user.click(screen.getByRole('button', { name: /Agregar al calendario/i }));
		await user.click(screen.getByRole('button', { name: 'Apple Calendar (.ics)' }));

		expect(jest.mocked(generateIcsString)).toHaveBeenCalledWith(validEventData);
		expect(jest.mocked(downloadIcsFile)).toHaveBeenCalledWith(
			'BEGIN:VCALENDAR\nEND:VCALENDAR',
			validEventData.fileName,
		);
	});

	it('closes the provider popover with Escape and restores focus', async () => {
		const user = userEvent.setup();
		render(<AddToCalendarButton eventData={validEventData} />);

		const trigger = screen.getByRole('button', { name: /Agregar al calendario/i });
		await user.click(trigger);
		expect(screen.getByRole('link', { name: 'Google Calendar' })).toBeInTheDocument();

		await user.keyboard('{Escape}');

		await waitFor(() => {
			expect(screen.queryByRole('link', { name: 'Google Calendar' })).not.toBeInTheDocument();
		});
		expect(trigger).toHaveFocus();
	});
});
