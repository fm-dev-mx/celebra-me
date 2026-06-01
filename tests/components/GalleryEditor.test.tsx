import { fireEvent, render, screen } from '@testing-library/react';
import GalleryEditor from '@/components/dashboard/intake/editor/GalleryEditor';

describe('GalleryEditor', () => {
	it('edits captions and reorders the complete gallery value', () => {
		const onChange = jest.fn();
		const value = {
			title: 'Galería',
			items: [
				{ image: 'gallery01', caption: 'Primera' },
				{ image: 'gallery02', caption: 'Segunda' },
			],
		};

		render(
			<GalleryEditor value={value} previewSlug="demo-xv-jewelry-box" onChange={onChange} />,
		);

		fireEvent.change(screen.getAllByLabelText('Pie de foto')[0], {
			target: { value: 'Nuevo pie' },
		});
		expect(onChange).toHaveBeenLastCalledWith({
			...value,
			items: [{ image: 'gallery01', caption: 'Nuevo pie' }, value.items[1]],
		});

		fireEvent.click(screen.getAllByText('Bajar')[0]);
		expect(onChange).toHaveBeenLastCalledWith({
			...value,
			items: [value.items[1], value.items[0]],
		});
	});
});
