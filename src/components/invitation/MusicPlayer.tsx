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
	const [isMuted, setIsMuted] = useState(false);
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

	const toggleMute = () => {
		if (!audioRef.current) return;
		audioRef.current.muted = !isMuted;
		setIsMuted(!isMuted);
	};

	return (
		<div className="music-player">
			<audio ref={audioRef} src={url} loop preload="auto" />

			{showPrompt && !isPlaying && (
				<span className="music-player__prompt">Toca para escuchar música</span>
			)}

			<div className="music-player__controls">
				{/* Mute toggle (secondary) */}
				{isPlaying && (
					<button
						type="button"
						className="music-player__button music-player__button--mute"
						onClick={toggleMute}
						aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
					>
						{isMuted ? (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								width="20"
								height="20"
							>
								<path d="M3.63 3.63a.75.75 0 0 1 1.06 0l15.68 15.68a.75.75 0 1 1-1.06 1.06l-3.84-3.84a7.5 7.5 0 0 1-2.22.72V19.5a.75.75 0 0 1-1.5 0v-2.25a7.5 7.5 0 0 1-6.75-7.5.75.75 0 0 1 1.5 0 6 6 0 0 0 8.07 5.64l-1.27-1.27a4.5 4.5 0 0 1-5.3-4.37.75.75 0 0 1 1.5 0 3 3 0 0 0 3.3 2.98l-1.27-1.27a1.5 1.5 0 0 1-.53-1.14V8.56l-9-9a.75.75 0 0 1 0-1.06ZM12 4.5a.75.75 0 0 1 .75.75v5.69l6 6V5.25a.75.75 0 0 1 1.5 0v12.44l1.28 1.28A.75.75 0 0 1 21 18h-.75a7.5 7.5 0 0 0-1.28-4.22l-1.08 1.08A6 6 0 0 1 18 12a.75.75 0 0 1 1.5 0c0 1.52-.45 2.93-1.22 4.12l1.87 1.87a.75.75 0 1 1-1.06 1.06L12 11.94V5.25A.75.75 0 0 1 12 4.5Z" />
							</svg>
						) : (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								width="20"
								height="20"
							>
								<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
								<path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
							</svg>
						)}
					</button>
				)}

				{/* Play/Pause toggle (primary) */}
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
							<path d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V6.693c0-.426-.24-.816-.622-1.006L15.503 3.25a1.125 1.125 0 0 0-1.006 0L9.622 5.687a1.125 1.125 0 0 0-.622 1.006v10.614c0 .426.24.816.622 1.006l4.875 2.437a1.125 1.125 0 0 0 1.006 0Z" />
						</svg>
					)}
				</button>
			</div>
		</div>
	);
};

export default MusicPlayer;
