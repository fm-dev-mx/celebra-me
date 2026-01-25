// tests/components/MusicPlayer.test.tsx
// Component tests for the MusicPlayer

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MusicPlayer from '@/components/invitation/MusicPlayer';

describe('MusicPlayer Component', () => {
	const defaultProps = {
		url: 'https://example.com/audio.mp3',
		autoPlay: false,
		title: 'Música de fondo',
	};

	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks();
	});

	describe('Initial Render', () => {
		it('should render the play button', () => {
			render(<MusicPlayer {...defaultProps} />);

			const playButton = screen.getByRole('button', { name: defaultProps.title });
			expect(playButton).toBeInTheDocument();
		});

		it('should render the audio element with correct src', () => {
			const { container } = render(<MusicPlayer {...defaultProps} />);

			const audioElement = container.querySelector('audio');
			expect(audioElement).toHaveAttribute('src', defaultProps.url);
		});

		it('should show the prompt message initially', () => {
			render(<MusicPlayer {...defaultProps} />);

			expect(screen.getByText(/Toca para escuchar música/i)).toBeInTheDocument();
		});

		it('should not show mute button when not playing', () => {
			render(<MusicPlayer {...defaultProps} />);

			expect(screen.queryByRole('button', { name: /Silenciar/i })).not.toBeInTheDocument();
		});
	});

	describe('Play/Pause Toggle', () => {
		it('should call audio.play() when play button is clicked', async () => {
			const user = userEvent.setup();
			const { container } = render(<MusicPlayer {...defaultProps} />);

			const audioElement = container.querySelector('audio') as HTMLAudioElement;
			const playButton = screen.getByRole('button', { name: defaultProps.title });

			await user.click(playButton);

			expect(audioElement.play).toHaveBeenCalled();
		});

		it('should hide the prompt after play is clicked', async () => {
			const user = userEvent.setup();
			render(<MusicPlayer {...defaultProps} />);

			const playButton = screen.getByRole('button', { name: defaultProps.title });
			await user.click(playButton);

			expect(screen.queryByText(/Toca para escuchar música/i)).not.toBeInTheDocument();
		});

		it('should show mute button after play is started', async () => {
			const user = userEvent.setup();
			render(<MusicPlayer {...defaultProps} />);

			const playButton = screen.getByRole('button', { name: defaultProps.title });
			await user.click(playButton);

			// After playing, mute button should appear
			expect(screen.getByRole('button', { name: /Silenciar/i })).toBeInTheDocument();
		});

		it('should change to pause button after play', async () => {
			const user = userEvent.setup();
			render(<MusicPlayer {...defaultProps} />);

			const playButton = screen.getByRole('button', { name: defaultProps.title });
			await user.click(playButton);

			// Button should now have pause label
			expect(screen.getByRole('button', { name: /Pausar música/i })).toBeInTheDocument();
		});

		it('should call audio.pause() when pause button is clicked', async () => {
			const user = userEvent.setup();
			const { container } = render(<MusicPlayer {...defaultProps} />);

			const audioElement = container.querySelector('audio') as HTMLAudioElement;

			// Start playing
			const playButton = screen.getByRole('button', { name: defaultProps.title });
			await user.click(playButton);

			// Now pause
			const pauseButton = screen.getByRole('button', { name: /Pausar música/i });
			await user.click(pauseButton);

			expect(audioElement.pause).toHaveBeenCalled();
		});
	});

	describe('Mute Toggle', () => {
		it('should toggle mute state when mute button is clicked', async () => {
			const user = userEvent.setup();
			render(<MusicPlayer {...defaultProps} />);

			// Start playing first
			const playButton = screen.getByRole('button', { name: defaultProps.title });
			await user.click(playButton);

			// Click mute
			const muteButton = screen.getByRole('button', { name: /Silenciar/i });
			await user.click(muteButton);

			// Should now show "Activar sonido"
			expect(screen.getByRole('button', { name: /Activar sonido/i })).toBeInTheDocument();
		});

		it('should toggle audio.muted property', async () => {
			const user = userEvent.setup();
			const { container } = render(<MusicPlayer {...defaultProps} />);

			const audioElement = container.querySelector('audio') as HTMLAudioElement;

			// Start playing
			await user.click(screen.getByRole('button', { name: defaultProps.title }));

			// Mute
			await user.click(screen.getByRole('button', { name: /Silenciar/i }));

			expect(audioElement.muted).toBe(true);
		});
	});

	describe('Accessibility', () => {
		it('should have aria-label on play button', () => {
			render(<MusicPlayer {...defaultProps} />);

			const playButton = screen.getByRole('button', { name: defaultProps.title });
			expect(playButton).toHaveAttribute('aria-label', defaultProps.title);
		});

		it('should have aria-label on mute button when visible', async () => {
			const user = userEvent.setup();
			render(<MusicPlayer {...defaultProps} />);

			await user.click(screen.getByRole('button', { name: defaultProps.title }));

			const muteButton = screen.getByRole('button', { name: /Silenciar/i });
			expect(muteButton).toHaveAttribute('aria-label');
		});

		it('should have type="button" to prevent form submission', () => {
			render(<MusicPlayer {...defaultProps} />);

			const buttons = screen.getAllByRole('button');
			buttons.forEach((button) => {
				expect(button).toHaveAttribute('type', 'button');
			});
		});
	});

	describe('Audio Element Configuration', () => {
		it('should have loop attribute', () => {
			const { container } = render(<MusicPlayer {...defaultProps} />);

			const audioElement = container.querySelector('audio');
			expect(audioElement).toHaveAttribute('loop');
		});

		it('should have preload="auto" attribute', () => {
			const { container } = render(<MusicPlayer {...defaultProps} />);

			const audioElement = container.querySelector('audio');
			expect(audioElement).toHaveAttribute('preload', 'auto');
		});
	});
});
