import React, { useState, useRef, useEffect } from 'react';
import '@/styles/invitation/_background-music.scss';
import { PlayIcon, PauseIcon } from '@/components/common/icons/ui';

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
					{isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
				</button>
			</div>
		</div>
	);
};

export default MusicPlayer;
