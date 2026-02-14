// src/components/invitation/PhotoGallery.tsx

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';

import type { ImageMetadata } from 'astro';
import type { ImageAsset } from '@/lib/assets/AssetRegistry';

interface GalleryItem {
	image: ImageMetadata | ImageAsset;
	caption?: string;
}

const getSrc = (image: ImageMetadata | ImageAsset): string => {
	if ('src' in image) {
		// ImageAsset or ImageMetadata
		const src = image.src;
		if (typeof src === 'string') return src;
		return src.src;
	}
	// Fallback? Types say it must be one of the above.
	// ImageMetadata has src string. ImageAsset has src string|Metadata.
	// Actually, ImageMetadata has src property.
	return (image as ImageMetadata).src;
};

interface PhotoGalleryProps {
	items: GalleryItem[];
	variant?: string;
}

const getLuxuryLayoutClass = (index: number): string => {
	if (index === 0) return 'gallery-grid__item--feature';
	if (index === 1 || index === 2 || index === 7) return 'gallery-grid__item--wide';
	return 'gallery-grid__item--standard';
};

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ items, variant = 'standard' }) => {
	const [selectedImage, setSelectedImage] = useState<number | null>(null);
	const [visibleItems, setVisibleItems] = useState<Record<number, true>>({});
	const [isTouchDevice, setIsTouchDevice] = useState(false);
	const shouldReduceMotion = useReducedMotion();

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

	// Keep interaction mode in sync so touch devices can use a single "active" in-view item.
	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;

		const mediaQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
		const updateTouchMode = (event?: MediaQueryListEvent) => {
			setIsTouchDevice(event ? event.matches : mediaQuery.matches);
		};
		const hasModernListenerAPI = 'addEventListener' in mediaQuery;

		updateTouchMode();
		if (hasModernListenerAPI) {
			mediaQuery.addEventListener('change', updateTouchMode);
		} else {
			(mediaQuery as any).addListener(updateTouchMode);
		}

		return () => {
			if (hasModernListenerAPI) {
				mediaQuery.removeEventListener('change', updateTouchMode);
			} else {
				(mediaQuery as any).removeListener(updateTouchMode);
			}
		};
	}, []);

	const containerVariants: Variants = shouldReduceMotion
		? {
				hidden: { opacity: 1 },
				visible: { opacity: 1 },
			}
		: {
				hidden: { opacity: 0 },
				visible: {
					opacity: 1,
					transition: {
						staggerChildren: 0.1,
					},
				},
			};

	const itemVariants: Variants = shouldReduceMotion
		? {
				hidden: { opacity: 1, y: 0 },
				visible: { opacity: 1, y: 0, transition: { duration: 0 } },
			}
		: {
				hidden: { opacity: 0, y: 20 },
				visible: {
					opacity: 1,
					y: 0,
					transition: {
						duration: 0.8,
						ease: 'easeOut',
					},
				},
			};

	const markItemAsVisible = (index: number) => {
		setVisibleItems((current) => {
			const shouldUseSingleActiveItem = variant === 'luxury-hacienda' && isTouchDevice;
			if (shouldUseSingleActiveItem) {
				if (current[index]) return current;
				return { [index]: true };
			}

			if (current[index]) return current;
			return { ...current, [index]: true };
		});
	};

	return (
		<>
			<motion.div
				className="gallery-grid"
				variants={containerVariants}
				initial={shouldReduceMotion ? 'visible' : 'hidden'}
				whileInView={shouldReduceMotion ? undefined : 'visible'}
				viewport={shouldReduceMotion ? undefined : { once: true, margin: '-100px' }}
			>
				{items.map((item, index) => (
					<motion.div
						key={index}
						className={`gallery-grid__item ${variant === 'luxury-hacienda' ? getLuxuryLayoutClass(index) : 'gallery-grid__item--standard'} ${visibleItems[index] ? 'is-in-view' : ''}`}
						data-in-view={visibleItems[index] ? 'true' : 'false'}
						variants={itemVariants}
						onViewportEnter={() => markItemAsVisible(index)}
						viewport={{ once: true, amount: 0.3 }}
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
						<img
							src={getSrc(item.image)}
							alt={item.caption || `Galería ${index + 1}`}
							loading="lazy"
						/>
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
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>

						<motion.div
							className="gallery-lightbox__content"
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.9, opacity: 0 }}
							transition={{ type: 'spring', damping: 25, stiffness: 200 }}
							onClick={(e) => e.stopPropagation()}
						>
							<img
								src={getSrc(items[selectedImage].image)}
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
