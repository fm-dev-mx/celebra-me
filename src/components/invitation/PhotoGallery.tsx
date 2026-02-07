// src/components/invitation/PhotoGallery.tsx

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

interface GalleryItem {
	image: {
		src: string;
		width: number;
		height: number;
		format: string;
	};
	caption?: string;
}

interface PhotoGalleryProps {
	items: GalleryItem[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ items }) => {
	const [selectedImage, setSelectedImage] = useState<number | null>(null);

	// Keyboard and scroll lock effect
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setSelectedImage(null);
			}
		};

		if (selectedImage !== null) {
			document.body.style.overflow = 'hidden';
			window.addEventListener('keydown', handleKeyDown);
		} else {
			document.body.style.overflow = '';
		}

		return () => {
			document.body.style.overflow = '';
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [selectedImage]);

	const containerVariants: Variants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.1,
			},
		},
	};

	const itemVariants: Variants = {
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.8,
				ease: "easeOut",
			},
		},
	};

	return (
		<>
			<motion.div
				className="gallery-grid"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: "-100px" }}
			>
				{items.map((item, index) => (
					<motion.div
						key={index}
						className="gallery-grid__item"
						variants={itemVariants}
						onClick={() => setSelectedImage(index)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								setSelectedImage(index);
							}
						}}
						tabIndex={0}
						role="button"
						aria-label={item.caption || `Ver imagen ${index + 1}`}
					>
						<img src={item.image.src} alt={item.caption || `Galería ${index + 1}`} loading="lazy" />
						{item.caption && (
							<div className="gallery-grid__overlay">
								<p className="gallery-grid__caption">{item.caption}</p>
							</div>
						)}
					</motion.div>
				))}
			</motion.div>

			<AnimatePresence>
				{selectedImage !== null && (
					<motion.div
						className="gallery-lightbox"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setSelectedImage(null)}
						role="dialog"
						aria-modal="true"
						aria-label="Vista ampliada de la imagen"
					>
						<button
							className="gallery-lightbox__close"
							onClick={() => setSelectedImage(null)}
							aria-label="Cerrar galería"
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>

						<motion.div
							className="gallery-lightbox__content"
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.9, opacity: 0 }}
							transition={{ type: "spring", damping: 25, stiffness: 200 }}
							onClick={(e) => e.stopPropagation()}
						>
							<img
								src={items[selectedImage].image.src}
								alt={items[selectedImage].caption || `Galería ${selectedImage + 1}`}
							/>
							{items[selectedImage].caption && (
								<div className="gallery-lightbox__footer">
									<p>{items[selectedImage].caption}</p>
								</div>
							)}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
};

export default PhotoGallery;
