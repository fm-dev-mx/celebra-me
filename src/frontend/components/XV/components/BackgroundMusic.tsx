// src/frontend/components/XV/components/BackgroundMusic.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import '@styles/XV/background-music.scss';
import PlayButton from './PlayButton.xv';

/**
 * Custom hook to determine if an element is visible in the viewport.
 * Falls back to visible if IntersectionObserver is not supported.
 */
const useIntersectionObserver = (
	ref: React.RefObject<Element | null>,
	options: IntersectionObserverInit = { root: null, threshold: 0.1 },
): boolean => {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;

		if (!('IntersectionObserver' in window)) {
			// Fallback for older browsers: immediately mark as visible.
			setIsVisible(true);
			return;
		}

		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.unobserve(entry.target);
				}
			});
		}, options);

		observer.observe(element);

		return () => {
			if (element) observer.unobserve(element);
			observer.disconnect();
		};
	}, [ref, options]);

	return isVisible;
};

/**
 * Custom hook for idle timer management.
 * When user activity is detected, the timer resets.
 * If no activity occurs for the specified timeout, the onIdle callback is invoked.
 */
const useIdleTimer = (isPlaying: boolean, idleTimeoutMs: number, onIdle: () => void) => {
	const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearTimer = useCallback(() => {
		if (idleTimer.current) {
			clearTimeout(idleTimer.current);
			idleTimer.current = null;
		}
	}, []);

	const startTimer = useCallback(() => {
		clearTimer();
		idleTimer.current = setTimeout(() => {
			onIdle();
		}, idleTimeoutMs);
	}, [clearTimer, idleTimeoutMs, onIdle]);

	const handleUserActivity = useCallback(() => {
		if (isPlaying) {
			clearTimer();
			startTimer();
		}
	}, [isPlaying, clearTimer, startTimer]);

	useEffect(() => {
		window.addEventListener('mousemove', handleUserActivity);
		window.addEventListener('click', handleUserActivity);
		window.addEventListener('touchstart', handleUserActivity);

		return () => {
			window.removeEventListener('mousemove', handleUserActivity);
			window.removeEventListener('click', handleUserActivity);
			window.removeEventListener('touchstart', handleUserActivity);
			clearTimer();
		};
	}, [handleUserActivity, clearTimer]);

	return { startTimer, clearTimer };
};

const BackgroundMusic: React.FC = () => {
	// Refs for the audio element and the component container.
	const audioRef = useRef<HTMLAudioElement>(null);
	const componentRef = useRef<HTMLDivElement>(null);

	// State for audio playback, compact mode, and whether the audio source is loaded.
	const [isPlaying, setIsPlaying] = useState(false);
	const [isCompact, setIsCompact] = useState(false);
	const [isSourceLoaded, setIsSourceLoaded] = useState(false);

	// Lazy-load the component using IntersectionObserver.
	const isComponentVisible = useIntersectionObserver(componentRef, {
		root: null,
		threshold: 0.1,
	});

	// Use a ref to keep track of the latest compact mode state to avoid re-registering events.
	const isCompactRef = useRef(isCompact);
	useEffect(() => {
		isCompactRef.current = isCompact;
	}, [isCompact]);

	// Audio source URL and idle timeout constants.
	const audioSourceUrl = 'https://pub-651602ccdef14f40bd29dbd4e02c31da.r2.dev/Only-LeeHi.MP3';
	const idleTimeoutMs = 60 * 4180; // 4.18 minute idle timeout

	// Callback invoked on idle timeout.
	const onIdle = useCallback(() => {
		if (isPlaying && audioRef.current) {
			audioRef.current.pause();
			setIsPlaying(false);
			console.log('Auto-paused due to inactivity.');
		}
	}, [isPlaying]);

	// Initialize the idle timer hook.
	const { startTimer, clearTimer } = useIdleTimer(isPlaying, idleTimeoutMs, onIdle);

	// Scroll event handler to activate compact mode.
	const handleScroll = useCallback(() => {
		if (window.scrollY > 150 && !isCompactRef.current) {
			setIsCompact(true);
		}
	}, []);

	useEffect(() => {
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, [handleScroll]);

	/**
	 * Handles playback toggling:
	 * - Activates compact mode on first interaction.
	 * - Dynamically loads the audio source on first play.
	 * - Toggles audio playback and manages the idle timer.
	 */
	const handlePlayback = useCallback(() => {
		if (!audioRef.current) return;

		if (!isCompact) {
			setIsCompact(true);
			window.dispatchEvent(new CustomEvent('onboarding-play-click'));
		}

		if (!isSourceLoaded) {
			audioRef.current.src = audioSourceUrl;
			setIsSourceLoaded(true);
		}

		if (isPlaying) {
			audioRef.current.pause();
			setIsPlaying(false);
			clearTimer();
		} else {
			audioRef.current
				.play()
				.then(() => {
					setIsPlaying(true);
					clearTimer();
					startTimer();
				})
				.catch((error) => console.error('Playback failed:', error));
		}
	}, [isPlaying, isCompact, isSourceLoaded, audioSourceUrl, clearTimer, startTimer]);

	return (
		<div className="background-music" ref={componentRef}>
			{isComponentVisible && (
				<>
					{/* The audio element uses preload="none" and its src is set dynamically on first play */}
					<audio ref={audioRef} loop preload="none">
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
				</>
			)}
		</div>
	);
};

export default BackgroundMusic;
