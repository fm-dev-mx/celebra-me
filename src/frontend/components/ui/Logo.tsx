/**
 * src/components/ui/Logo.tsx
 * Logo component that displays the main logo with a responsive image setup,
 * supporting multiple variants (default, footer, hero) for consistent branding.
 */
import React from 'react';

interface LogoProps {
	variant?: 'default' | 'footer' | 'hero' | 'xv'; // Defines possible logo variants
	altText?: string; // Optional alt text for accessibility
}

const Logo: React.FC<LogoProps> = ({ variant = 'default', altText }) => {
	// Determine image sources based on the variant
	const getImageSources = () => {
		switch (variant) {
			case 'footer':
				return {
					src: '/images/footer/darkModeRectangularLogo200x100.png',
				};
			case 'hero':
				return {
					src: '/images/hero/rectangleLogo400x200.png',
					srcSet:
						'/images/hero/rectangleLogo200x100.png 200w, ' +
						'/images/hero/rectangleLogo250x125.png 250w, ' +
						'/images/hero/rectangleLogo300x150.png 300w, ' +
						'/images/hero/rectangleLogo350x175.png 360w, ' +
						'/images/hero/rectangleLogo400x200.png 400w',
					sizes:
						'(max-width: 480px) 200px, ' +
						'(max-width: 640px) 250px, ' +
						'(max-width: 768px) 300px, ' +
						'(max-width: 1024px) 360px, ' +
						'400px',
				};
			case 'xv':
				return {
					src: '/images/header/horizontalLogo100x38.png',
					srcSet:
						'/images/header/horizontalLogo125x47.png 125w, ' +
						'/images/header/horizontalLogo150x56.png 150w',
					sizes: '(max-width: 480px) 100px, ' + '(max-width: 640px) 125px, ' + '150px',
				};
			default:
				return {
					src: '/images/header/horizontalLogo100x38.png',
					srcSet:
						'/images/header/horizontalLogo125x47.png 125w, ' +
						'/images/header/horizontalLogo150x56.png 150w',
					sizes: '(max-width: 480px) 100px, ' + '(max-width: 640px) 125px, ' + '150px',
				};
		}
	};

	const { src, srcSet, sizes } = getImageSources();

	return (
		<div className={`logo-wrapper logo-wrapper--${variant}`}>
			<a
				href="/"
				className={variant === 'hero' ? 'logo-link logo-link--hero' : 'logo-link'}
				aria-label={altText || 'Go to the homepage'}
			>
				<img src={src} srcSet={srcSet} sizes={sizes} alt={altText || 'celebra-me.com'} />
			</a>
		</div>
	);
};

export default Logo;
