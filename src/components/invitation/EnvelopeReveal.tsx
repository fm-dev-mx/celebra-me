// src/components/invitation/EnvelopeReveal.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';

interface Props {
	name: string;
	date: string;
	city: string;
	sealStyle: 'wax' | 'ribbon' | 'flower' | 'monogram';
	microcopy: string;
	palette: {
		primary: string;
		accent: string;
		background: string;
	};
}

const EnvelopeReveal: React.FC<Props> = ({ name, date, city, sealStyle, microcopy, palette }) => {
	const shouldReduceMotion = useReducedMotion();
	const [phase, setPhase] = useState<'closed' | 'opening' | 'rising' | 'exit'>(() => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			if (params.get('skipEnvelope') === 'true') {
				return 'exit';
			}
		}
		return 'closed';
	});
	const controls = useAnimation();

	const handleOpen = () => {
		if (phase !== 'closed') return;

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
							{/* Official Stamp / Tax Marker Area (Asymmetric) */}
							<div className="envelope-stamp-area">
								<div className="envelope-stamp">
									<span>TAX PAID</span>
									<small>1866</small>
								</div>
							</div>

							<div className="tease-header">
								<span className="envelope-manifest-label">MANIFEST / WANTED</span>
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
											<div className="seal-visual">
												{sealStyle === 'wax' ? (
													<svg
														className="seal-icon"
														viewBox="0 0 24 24"
														fill="currentColor"
													>
														{/* Cowboy Boot Silhouette */}
														<path d="M20,21H4a1,1,0,0,1-1-1V18a3,3,0,0,1,3-3h4V12a2,2,0,0,1,2-2h1V6a3.5,3.5,0,0,1,3.5-3.5A3.5,3.5,0,0,1,20,6V20A1,1,0,0,1,20,21ZM5,19H18V6a1.5,1.5,0,0,0-3,0v5a1,1,0,0,1-1,1H12v3a1,1,0,0,1-1,1H6a1,1,0,0,0-1,1Z" />
													</svg>
												) : (
													<svg
														className="seal-icon"
														viewBox="0 0 24 24"
														fill="currentColor"
													>
														<path
															d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
															opacity="0.3"
														/>
														<path d="M12,6a6,6,0,1,0,6,6A6,6,0,0,0,12,6Zm0,10a4,4,0,1,1,4-4A4,4,0,0,1,12,16Z" />
													</svg>
												)}
											</div>
											<div className="seal-pulse" />
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
