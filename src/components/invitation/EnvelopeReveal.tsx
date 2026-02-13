// src/components/invitation/EnvelopeReveal.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';
import {
	BootSealIcon,
	HeartSealIcon,
	MonogramSealIcon,
	FlowerSealIcon,
} from '@/components/common/icons/invitation';

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
	tooltipText?: string;
}

const EnvelopeReveal: React.FC<Props> = ({
	name,
	date,
	city,
	sealStyle,
	sealIcon,
	documentLabel,
	stampText,
	stampYear,
	eventSlug,
	tooltipText,
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

			// In DEV mode, we always want to see the envelope unless skip is present
			const isDev = import.meta.env.DEV;
			if (wasOpened && !isDev) {
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
				return <BootSealIcon className={iconClass} />;
			case 'heart':
				return <HeartSealIcon className={iconClass} />;
			case 'flower':
				return <FlowerSealIcon className={iconClass} />;
			case 'monogram':
			default:
				return <MonogramSealIcon className={iconClass} />;
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
											className={`envelope-seal-button envelope-seal-button--${sealStyle}`}
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
											aria-label="Abrir sobre de la invitación"
										>
											<div className="seal-visual">{renderSealIcon()}</div>
											<div className="seal-pulse" />

											{/* Tooltip - appears after 1.5s delay */}
											<AnimatePresence>
												{showTooltip && (
													<motion.span
														className="envelope-tooltip"
														initial={{ opacity: 0, x: 10 }}
														animate={{ opacity: 1, x: 0 }}
														exit={{ opacity: 0, x: 5 }}
														transition={{ duration: 0.3 }}
													>
														{tooltipText || 'Abre el sobre'}
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
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export default EnvelopeReveal;
