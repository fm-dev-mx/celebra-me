import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import ItineraryEditor from '@/components/dashboard/intake/editor/ItineraryEditor';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

type Itinerary = NonNullable<DraftContent['itinerary']>;
type ItineraryItem = Itinerary['items'][number];

const DEFAULT_ITEM: ItineraryItem = {
	iconName: 'Church' as ItineraryItem['iconName'],
	label: 'Ceremonia',
	description: '',
	time: '16:00',
};

function ItineraryEditorHarness({
	initialValue = { items: [DEFAULT_ITEM] },
}: { initialValue?: Itinerary } = {}) {
	const [value, setValue] = useState(initialValue);
	return <ItineraryEditor value={value} onChange={(next) => setValue(next)} />;
}

function getDetails(): HTMLDetailsElement {
	const summary = screen.getByText('Editar actividad');
	return summary.closest('details') as HTMLDetailsElement;
}

describe('ItineraryEditor', () => {
	it('keeps activity editor expanded after changing time', () => {
		render(<ItineraryEditorHarness />);

		fireEvent.click(screen.getByText('Editar actividad'));
		const details = getDetails();
		expect(details.open).toBe(true);

		fireEvent.change(screen.getByLabelText('Hora'), {
			target: { value: '18:00' },
		});

		expect(details.open).toBe(true);
	});

	it('keeps activity editor expanded after changing icon', () => {
		render(<ItineraryEditorHarness />);

		fireEvent.click(screen.getByText('Editar actividad'));
		const details = getDetails();
		expect(details.open).toBe(true);

		const iconTrigger = screen.getByRole('button', { name: /iglesia/i });
		fireEvent.click(iconTrigger);

		fireEvent.click(screen.getByRole('button', { name: /pastel/i }));

		expect(details.open).toBe(true);
	});

	it('adds an activity', () => {
		render(<ItineraryEditorHarness />);

		fireEvent.click(screen.getByText('Agregar actividad'));

		expect(screen.getByText(/2\. Actividad · Acordeón · Sin hora/)).toBeInTheDocument();
	});

	it('deletes an activity', () => {
		render(
			<ItineraryEditorHarness
				initialValue={{
					items: [
						{
							iconName: 'Church' as ItineraryItem['iconName'],
							label: 'Ceremonia',
							time: '16:00',
						},
						{
							iconName: 'Cake' as ItineraryItem['iconName'],
							label: 'Pastel',
							time: '17:00',
						},
					],
				}}
			/>,
		);

		expect(screen.getByText(/Ceremonia/)).toBeInTheDocument();

		const deleteButtons = screen.getAllByText('Eliminar');
		fireEvent.click(deleteButtons[0]);

		expect(screen.queryByText(/Ceremonia/)).not.toBeInTheDocument();
		expect(screen.getByText(/1\. Pastel/)).toBeInTheDocument();
	});

	it('reorders activities', () => {
		render(
			<ItineraryEditorHarness
				initialValue={{
					items: [
						{
							iconName: 'Church' as ItineraryItem['iconName'],
							label: 'Ceremonia',
							time: '16:00',
						},
						{
							iconName: 'Cake' as ItineraryItem['iconName'],
							label: 'Pastel',
							time: '17:00',
						},
					],
				}}
			/>,
		);

		const articles = screen.getAllByRole('article');
		expect(articles[0]).toHaveTextContent(/Ceremonia/);
		expect(articles[1]).toHaveTextContent(/Pastel/);

		const moveUpButtons = screen.getAllByText('Subir');
		fireEvent.click(moveUpButtons[1]);

		expect(articles[0]).toHaveTextContent(/Pastel/);
		expect(articles[1]).toHaveTextContent(/Ceremonia/);
	});

	it('renders with empty items array', () => {
		render(<ItineraryEditorHarness initialValue={{ items: [] }} />);

		expect(screen.getByText('Agregar actividad')).toBeInTheDocument();
		expect(screen.queryByText(/1\./)).not.toBeInTheDocument();
	});

	it('disables Subir on first item and Bajar on last item', () => {
		render(
			<ItineraryEditorHarness
				initialValue={{
					items: [
						{
							iconName: 'Church' as ItineraryItem['iconName'],
							label: 'Ceremonia',
							time: '16:00',
						},
						{
							iconName: 'Cake' as ItineraryItem['iconName'],
							label: 'Pastel',
							time: '17:00',
						},
					],
				}}
			/>,
		);

		const upButtons = screen.getAllByText('Subir');
		expect(upButtons[0]).toBeDisabled();
		expect(upButtons[1]).not.toBeDisabled();

		const downButtons = screen.getAllByText('Bajar');
		expect(downButtons[0]).not.toBeDisabled();
		expect(downButtons[1]).toBeDisabled();
	});
});
