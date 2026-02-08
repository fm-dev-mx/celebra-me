import React, { useState, useRef, useEffect } from 'react';
import '@/styles/invitation/_background-music.scss';

interface MusicPlayerProps {
	url: string;
	autoPlay?: boolean;
	title?: string;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({
	url,
	autoPlay = false,
	title = 'Música de fondo',
}) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [showPrompt, setShowPrompt] = useState(true);
	const audioRef = useRef<HTMLAudioElement>(null);

	// Handle autoPlay with user interaction requirement
	useEffect(() => {
		if (autoPlay && audioRef.current) {
			// Modern browsers require user interaction before autoplay
			// We'll show the prompt and let the user initiate playback
			const handleFirstInteraction = () => {
				if (audioRef.current && autoPlay) {
					audioRef.current.play().catch(() => {
						// Autoplay blocked, user needs to click
					});
					setIsPlaying(true);
					setShowPrompt(false);
				}
				// Remove listeners after first interaction
				document.removeEventListener('click', handleFirstInteraction);
				document.removeEventListener('touchstart', handleFirstInteraction);
			};

			document.addEventListener('click', handleFirstInteraction, { once: true });
			document.addEventListener('touchstart', handleFirstInteraction, { once: true });

			return () => {
				document.removeEventListener('click', handleFirstInteraction);
				document.removeEventListener('touchstart', handleFirstInteraction);
			};
		}
	}, [autoPlay]);

	// Auto-dismiss prompt 5 seconds AFTER envelope opens (invitation-revealed class)
	useEffect(() => {
		if (!showPrompt || isPlaying) return;

		let dismissTimer: ReturnType<typeof setTimeout>;
		let observer: MutationObserver;

		const startDismissTimer = () => {
			dismissTimer = setTimeout(() => {
				setShowPrompt(false);
			}, 5000);
		};

		// Check if envelope already opened
		if (document.body.classList.contains('invitation-revealed')) {
			startDismissTimer();
		} else {
			// Watch for the class to be added
			observer = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (
						mutation.type === 'attributes' &&
						mutation.attributeName === 'class' &&
						document.body.classList.contains('invitation-revealed')
					) {
						startDismissTimer();
						observer.disconnect();
						break;
					}
				}
			});

			observer.observe(document.body, {
				attributes: true,
				attributeFilter: ['class'],
			});
		}

		return () => {
			if (dismissTimer) clearTimeout(dismissTimer);
			if (observer) observer.disconnect();
		};
	}, [showPrompt, isPlaying]);

	const togglePlay = () => {
		if (!audioRef.current) return;

		if (isPlaying) {
			audioRef.current.pause();
			setIsPlaying(false);
		} else {
			audioRef.current.play().catch((error) => {
				console.warn('Audio playback failed:', error);
			});
			setIsPlaying(true);
			setShowPrompt(false);
		}
	};

	return (
		<div className="music-player">
			<audio ref={audioRef} src={url} loop preload="auto" />

			{showPrompt && !isPlaying && (
				<span className="music-player__prompt">Toca para escuchar música</span>
			)}

			<div className="music-player__controls">
				{/* Play/Pause toggle */}
				<button
					type="button"
					className={`music-player__button music-player__button--play ${!isPlaying ? 'music-player__button--pulsing' : ''}`}
					onClick={togglePlay}
					aria-label={isPlaying ? 'Pausar música' : title}
				>
					{isPlaying ? (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							width="24"
							height="24"
						>
							<path
								fillRule="evenodd"
								d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z"
								clipRule="evenodd"
							/>
						</svg>
					) : (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							width="24"
							height="24"
						>
							<path
								fillRule="evenodd"
								d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
								clipRule="evenodd"
							/>
						</svg>
					)}
				</button>
			</div>
		</div>
	);
};

export default MusicPlayer;
