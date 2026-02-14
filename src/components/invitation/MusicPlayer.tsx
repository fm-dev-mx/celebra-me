import React, { useState, useRef, useEffect } from 'react';
import '@/styles/invitation/_music-player.scss';
import { PlayIcon, PauseIcon } from '@/components/common/icons/ui';

interface MusicPlayerProps {
	url: string;
	autoPlay?: boolean;
	title?: string;
	revealMode?: 'envelope' | 'immediate';
	variant?: string;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({
	url,
	autoPlay = false,
	title = 'Música de fondo',
	revealMode = 'envelope',
	variant,
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

	// Auto-dismiss prompt based on reveal mode:
	// - envelope: start timer after body gets invitation-revealed
	// - immediate: start timer as soon as component mounts
	useEffect(() => {
		if (!showPrompt || isPlaying) return;

		let dismissTimer: ReturnType<typeof setTimeout> | undefined;
		let observer: MutationObserver;

		const startDismissTimer = () => {
			if (dismissTimer) clearTimeout(dismissTimer);
			dismissTimer = setTimeout(() => {
				setShowPrompt(false);
			}, 5000);
		};

		if (revealMode === 'immediate') {
			startDismissTimer();
		} else if (document.body.classList.contains('invitation-revealed')) {
			startDismissTimer();
		} else {
			// Watch for reveal class in envelope mode
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
	}, [showPrompt, isPlaying, revealMode]);

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
		<div className="music-player" data-variant={variant}>
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
