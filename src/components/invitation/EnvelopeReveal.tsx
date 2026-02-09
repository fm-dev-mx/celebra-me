// src/components/invitation/EnvelopeReveal.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';

interface Props {
	name: string;
	date: string;
	city: string;
	sealStyle: 'wax' | 'ribbon' | 'flower' | 'monogram';
	sealIcon?: 'boot' | 'heart' | 'monogram' | 'flower';
	microcopy: string;
	documentLabel?: string;
	stampText?: string;
	stampYear?: string;
	eventSlug: string;
	palette: {
		primary: string;
		accent: string;
		background: string;
	};
}

// Premium Boot SVG - Clean cowboy boot silhouette with spur detail
const BootIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor">
		<path d="M19.5,21H4.5a1,1,0,0,1-1-1V18a3,3,0,0,1,3-3h3.5v-2.5a2,2,0,0,1,2-2h1V7a3,3,0,0,1,3-3h.5a2,2,0,0,1,2,2V20A1,1,0,0,1,19.5,21ZM5.5,19H17.5V6a.5.5,0,0,0-.5-.5h-.5a1.5,1.5,0,0,0-1.5,1.5v4a1,1,0,0,1-1,1h-2v2.5a1,1,0,0,1-1,1h-4a1.5,1.5,0,0,0-1.5,1.5Z" />
		{/* Spur detail */}
		<ellipse cx="16.5" cy="18" rx="1" ry="0.5" opacity="0.6" />
		<line x1="17.5" y1="18" x2="19" y2="18.5" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
	</svg>
);

// Elegant Heart SVG for XV Años
const HeartIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor">
		<path d="M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5A5.447,5.447,0,0,1,7.5,3,5.988,5.988,0,0,1,12,5.09,5.988,5.988,0,0,1,16.5,3,5.447,5.447,0,0,1,22,8.5c0,3.78-3.4,6.86-8.55,11.54Z" />
	</svg>
);

// Monogram/Circle SVG for generic use
const MonogramIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor">
		<path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity="0.3" />
		<path d="M12,6a6,6,0,1,0,6,6A6,6,0,0,0,12,6Zm0,10a4,4,0,1,1,4-4A4,4,0,0,1,12,16Z" />
	</svg>
);

// Flower SVG
const FlowerIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor">
		<circle cx="12" cy="12" r="3" />
		<ellipse cx="12" cy="6" rx="2" ry="3" />
		<ellipse cx="12" cy="18" rx="2" ry="3" />
		<ellipse cx="6" cy="12" rx="3" ry="2" />
		<ellipse cx="18" cy="12" rx="3" ry="2" />
		<ellipse cx="7.5" cy="7.5" rx="2" ry="2.5" transform="rotate(-45 7.5 7.5)" />
		<ellipse cx="16.5" cy="7.5" rx="2" ry="2.5" transform="rotate(45 16.5 7.5)" />
		<ellipse cx="7.5" cy="16.5" rx="2" ry="2.5" transform="rotate(45 7.5 16.5)" />
		<ellipse cx="16.5" cy="16.5" rx="2" ry="2.5" transform="rotate(-45 16.5 16.5)" />
	</svg>
);

const EnvelopeReveal: React.FC<Props> = ({
	name,
	date,
	city,
	sealIcon,
	microcopy,
	documentLabel,
	stampText,
	stampYear,
	eventSlug,
	palette,
}) => {
	const shouldReduceMotion = useReducedMotion();
	const [showTooltip, setShowTooltip] = useState(false);

	// Persistence logic: Check if already opened
	const [phase, setPhase] = useState<'closed' | 'opening' | 'rising' | 'exit'>(() => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			if (params.get('skipEnvelope') === 'true') {
				return 'exit';
			}
			// Check for force parameter
			if (params.get('forceEnvelope') === 'true') {
				return 'closed';
			}
			// Check localStorage for "opened" flag
			const storageKey = `envelope-opened-${eventSlug}`;
			const wasOpened = localStorage.getItem(storageKey) === 'true';
			if (wasOpened) {
				return 'exit';
			}
		}
		return 'closed';
	});

	const controls = useAnimation();

	const handleOpen = () => {
		if (phase !== 'closed') return;

		// Save to localStorage
		if (typeof window !== 'undefined') {
			const storageKey = `envelope-opened-${eventSlug}`;
			localStorage.setItem(storageKey, 'true');
		}

		if (shouldReduceMotion) {
			setPhase('exit');
			document.body.style.overflow = 'auto';
			document.body.classList.add('invitation-revealed');
			return;
		}

		setPhase('opening');

		// Phase 2: Card rises after flap opens
		setTimeout(() => {
			setPhase('rising');
		}, 800);

		// Phase 3: Total exit to reveal invitation content
		setTimeout(() => {
			setPhase('exit');
			document.body.style.overflow = 'auto';
			document.body.classList.add('invitation-revealed');
		}, 3000);
	};

	// Tooltip delay logic
	useEffect(() => {
		if (phase !== 'closed') return;

		const tooltipTimer = setTimeout(() => {
			setShowTooltip(true);
		}, 1500);

		return () => clearTimeout(tooltipTimer);
	}, [phase]);

	useEffect(() => {
		const isLocked = phase === 'closed' || phase === 'opening' || phase === 'rising';
		document.body.style.overflow = isLocked ? 'hidden' : 'auto';

		if (phase === 'closed') {
			const handleScrollAttempt = () => {
				if (phase === 'closed') {
					controls.start({
						x: [0, -4, 4, -4, 4, 0],
						transition: { duration: 0.4 },
					});
				}
			};

			window.addEventListener('wheel', handleScrollAttempt);
			window.addEventListener('touchmove', handleScrollAttempt);

			return () => {
				window.removeEventListener('wheel', handleScrollAttempt);
				window.removeEventListener('touchmove', handleScrollAttempt);
				document.body.style.overflow = 'auto';
			};
		} else if (phase === 'exit') {
			document.body.classList.add('invitation-revealed');
		}

		return () => {
			document.body.style.overflow = 'auto';
		};
	}, [phase, controls]);

	const formattedDate = new Date(date).toLocaleDateString('es-MX', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});

	// Select the appropriate icon based on sealIcon prop
	const renderSealIcon = () => {
		const iconClass = `seal-icon seal-icon--${sealIcon || 'monogram'}`;
		switch (sealIcon) {
			case 'boot':
				return <BootIcon className={iconClass} />;
			case 'heart':
				return <HeartIcon className={iconClass} />;
			case 'flower':
				return <FlowerIcon className={iconClass} />;
			case 'monogram':
			default:
				return <MonogramIcon className={iconClass} />;
		}
	};

	return (
		<AnimatePresence>
			{phase !== 'exit' && (
				<motion.div
					className="envelope-wrapper"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{
						y: '-100%',
						transition: { duration: 1.2, ease: [0.4, 0, 0.2, 1] },
					}}
					style={
						{
							'--env-bg': palette.background,
							'--env-primary': palette.primary,
							'--env-accent': palette.accent,
						} as React.CSSProperties
					}
				>
					<motion.div className="envelope-container" animate={controls}>
						{/* 1. Base Layer (The Paper) */}
						<div className="envelope-base" />

						{/* 2. Rising Card (Depth 2) */}
						<div className={`envelope-card ${phase === 'rising' ? 'is-rising' : ''}`} />

						{/* 3. Pocket Layer (Depth 3) */}
						<div className="envelope-pocket" />

						{/* 4. Flap Layer (Depth 4 - Behind text) */}
						<div className={`envelope-flap ${phase !== 'closed' ? 'is-open' : ''}`} />

						{/* 5. The Content/Info Layer (Floating on Top) */}
						<div className="envelope-tease">
							{/* Official Stamp / Tax Marker Area (Theme-specific, only if stampText provided) */}
							{stampText && (
								<div className="envelope-stamp-area">
									<div className="envelope-stamp">
										<span>{stampText}</span>
										{stampYear && <small>{stampYear}</small>}
									</div>
								</div>
							)}

							<div className="tease-header">
								{/* Document label only if provided (Western theme) */}
								{documentLabel && (
									<span className="envelope-manifest-label">{documentLabel}</span>
								)}
								<h2 className="envelope-name">{name}</h2>
							</div>

							{/* Seal as layout participant (middle zone) */}
							<div className="envelope-seal-zone">
								<AnimatePresence>
									{phase === 'closed' && (
										<motion.button
											className="envelope-seal-button"
											onClick={handleOpen}
											initial={{ scale: 0, opacity: 0 }}
											animate={{
												scale: 1,
												opacity: 1,
												transition: { delay: 0.6, type: 'spring' },
											}}
											whileHover={{ scale: 1.1 }}
											exit={{
												scale: 1.5,
												opacity: 0,
												filter: 'blur(12px)',
												transition: { duration: 0.5 },
											}}
											aria-label="Abrir invitación"
										>
											<div className="seal-visual">{renderSealIcon()}</div>
											<div className="seal-pulse" />

											{/* Tooltip - appears after 1.5s delay */}
											<AnimatePresence>
												{showTooltip && (
													<motion.span
														className="envelope-tooltip"
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0 }}
														transition={{ duration: 0.3 }}
													>
														Toca el sello
													</motion.span>
												)}
											</AnimatePresence>
										</motion.button>
									)}
								</AnimatePresence>
							</div>

							<div className="tease-content-bottom">
								<div className="tease-divider" />
								<p className="envelope-details">
									{formattedDate} • {city}
								</p>
								<p className="envelope-microcopy">{microcopy}</p>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export default EnvelopeReveal;
