// src/frontend/components/XV/BackgroundMusic.tsx
import React, { useRef, useState, useEffect } from 'react';
import '@styles/XV/background-music.scss';
import PlayButton from './PlayButton.xv';

const BackgroundMusic: React.FC = () => {
	// Reference to the audio element
	const audioRef = useRef<HTMLAudioElement>(null);

	// State to track audio playback and compact mode.
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	// 'isCompact' determines if the button should be in its compact state.
	const [isCompact, setIsCompact] = useState<boolean>(false);

	/**
	 * Handles the button click:
	 * - Sets the button to compact mode.
	 * - Toggles audio playback.
	 */
	const handlePlayback = () => {
		if (!audioRef.current) return;

		// Activate compact mode (and remove pulsing/glow/prompt) on click.
		if (!isCompact) {
			setIsCompact(true);
			// Dispatch a custom event to notify the tooltip system that the play button was clicked.
			window.dispatchEvent(new CustomEvent('onboarding-play-click'));
		}

		// Toggle audio playback.
		if (isPlaying) {
			audioRef.current.pause();
			setIsPlaying(false);
		} else {
			audioRef.current
				.play()
				.then(() => setIsPlaying(true))
				.catch((error) => console.error('Playback failed:', error));
		}
	};

	// Listen for scroll events to activate compact mode after scrolling 150px.
	useEffect(() => {
		const handleScroll = () => {
			if (window.scrollY > 150 && !isCompact) {
				setIsCompact(true);
			}
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, [isCompact]);

	return (
		<div className="background-music">
			{/* Audio element loaded but playback starts after user interaction */}
			<audio ref={audioRef} loop preload="none">
				<source src="/audio/only-leehi.MP3" type="audio/mpeg" />
				Tu explorador no soporta audio.
			</audio>

			<button
				id="music-toggle"
				className={`music-toggle ${isCompact ? 'compact' : 'pulsing'}`}
				onClick={handlePlayback}
				aria-label={isPlaying ? 'Pause background music' : 'Play background music'}
			>
				{isPlaying ? (
					<span className="icon-pause">❚❚</span>
				) : (
					<span className="icon-play">
						<PlayButton />
					</span>
				)}
			</button>
		</div>
	);
};

export default BackgroundMusic;
