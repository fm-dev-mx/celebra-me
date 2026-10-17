import { render, screen } from '@testing-library/react';
import MemoriesUploadPanel from '@/components/memories/MemoriesUploadPanel';
import type { MemoriesGuestQuota } from '@/lib/memories/contract/catalog';
import type { MemoriesQueueEntry } from '@/lib/memories/client/upload-queue';
import {
	memoriesCaptureCopy as copy,
	memoriesGalleryCopy as galleryCopy,
} from '@/lib/memories/copy';

const QUOTA: MemoriesGuestQuota = {
	files: { used: 0, remaining: 15, limit: 15 },
	videos: { used: 0, remaining: 3, limit: 3 },
	bytes: { used: 0, remaining: 512 * 1024 * 1024, limit: 512 * 1024 * 1024 },
	inFlight: { used: 0, remaining: 2, limit: 2 },
};

function entry(
	id: string,
	file: File,
	status: MemoriesQueueEntry['status'] = 'ready',
): MemoriesQueueEntry {
	return {
		id,
		file,
		status,
		progress: 0,
		issue: status === 'invalid' ? 'video_too_large' : null,
		result: null,
		captionSaved: false,
		itemId: null,
	};
}

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' });
const video = (name: string, type = 'video/quicktime') => new File(['x'], name, { type });

function renderPanel(entries: MemoriesQueueEntry[], quota: MemoriesGuestQuota = QUOTA) {
	const createObjectURL = jest.fn((file: File) => `blob:test/${file.name}`);
	Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
	return render(
		<MemoriesUploadPanel
			inputId="memories-test"
			accept="image/*,video/*"
			maxSessionVideos={3}
			entries={entries}
			quota={quota}
			onFilesSelected={jest.fn()}
			onRemove={jest.fn()}
			onStart={jest.fn()}
			onCancel={jest.fn()}
		/>,
	);
}

describe('MemoriesUploadPanel review step', () => {
	it('subtracts the picked videos from the videos left', () => {
		renderPanel([entry('a', photo('uno.jpg')), entry('b', video('baile.mov'))]);

		expect(screen.getByText(copy.quotaRemaining(13, 15))).toBeInTheDocument();
		expect(screen.getByText(copy.quotaVideosRemaining(2))).toBeInTheDocument();
	});

	it('counts a video without a declared type and ignores invalid ones', () => {
		renderPanel([
			entry('a', video('vals.mp4', '')),
			entry('b', video('pesado.mov'), 'invalid'),
		]);

		expect(screen.getByText(copy.quotaVideosRemaining(2))).toBeInTheDocument();
	});

	it('never shows fewer than zero videos left', () => {
		renderPanel([entry('a', video('uno.mov')), entry('b', video('dos.mov'))], {
			...QUOTA,
			videos: { used: 2, remaining: 1, limit: 3 },
		});

		expect(screen.getByText(copy.quotaVideosRemaining(0))).toBeInTheDocument();
	});

	it('marks a picked video with a badge and a first-frame offset', async () => {
		const { container } = renderPanel([
			entry('a', photo('uno.jpg')),
			entry('b', video('baile.mov')),
		]);

		const tileVideo = await screen.findByText(galleryCopy.video);
		expect(tileVideo).toHaveClass('memories-tile__badge');
		expect(container.querySelectorAll('.memories-tile__badge')).toHaveLength(1);
		expect(container.querySelector('video')).toHaveAttribute(
			'src',
			'blob:test/baile.mov#t=0.001',
		);
	});
});
