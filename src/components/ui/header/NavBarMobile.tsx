import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { NavBarProps } from '../../../interfaces/ui/components/navBar.interface';

const NavBarMobile: React.FC<NavBarProps> = ({ headerId, links = [] }) => {
	const [isOpen, setIsOpen] = useState(false);

	const toggleMenu = () => setIsOpen(!isOpen);

	useEffect(() => {
		const header = document.getElementById(headerId);
		if (!header) return;

		if (isOpen) {
			header.classList.add('header-base--menu-open');
			document.body.style.overflow = 'hidden';
		} else {
			header.classList.remove('header-base--menu-open');
			document.body.style.overflow = '';
		}

		return () => {
			header.classList.remove('header-base--menu-open');
			document.body.style.overflow = '';
		};
	}, [isOpen, headerId]);

	return (
		<>
			{/* Hamburger Button */}
			<button
				onClick={toggleMenu}
				className="header-base__mobile-toggle"
				aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
			>
				<div className="hamburger">
					<motion.span
						animate={isOpen ? { rotate: 45, y: 9 } : { rotate: 0, y: 0 }}
						className="hamburger__line"
					/>
					<motion.span
						animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
						className="hamburger__line"
					/>
					<motion.span
						animate={isOpen ? { rotate: -45, y: -9 } : { rotate: 0, y: 0 }}
						className="hamburger__line"
					/>
				</div>
			</button>

			{/* Fullscreen Menu Overlay */}
			<AnimatePresence>
				{isOpen && (
					<>
						{/* Backdrop Blur */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={toggleMenu}
							className="header-base__mobile-overlay"
						/>

						<motion.nav
							id={`${headerId}-mobile-menu`}
							initial={{ x: '100%' }}
							animate={{ x: 0 }}
							exit={{ x: '100%' }}
							transition={{ type: 'spring', damping: 25, stiffness: 200 }}
							className="header-base__mobile-menu"
						>
							<div className="mobile-nav-links">
								{links.map((link, i) => (
									<motion.a
										key={i}
										href={link.href}
										initial={{ opacity: 0, x: 20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: 0.1 + i * 0.1 }}
										onClick={toggleMenu}
										className="mobile-nav-links__link"
									>
										{link.label}
									</motion.a>
								))}
							</div>

							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.5 }}
								className="mobile-nav-footer"
							>
								<div className="mobile-nav-footer__divider" />
								<p className="mobile-nav-footer__copy">CELEBRA-ME &copy; 2026</p>
							</motion.div>
						</motion.nav>
					</>
				)}
			</AnimatePresence>
		</>
	);
};

export default NavBarMobile;
