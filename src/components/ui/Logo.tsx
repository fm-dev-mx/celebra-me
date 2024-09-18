// src/components/ui/Logo.tsx
// Logo component displays the main logo with its respective link and responsive image setup.
// Supports multiple variants for different background styles, ensuring consistent branding.

import React from 'react';

// Define the props interface with a variant property to support multiple logo variants
interface LogoProps {
  variant?: 'default' | 'footer'; // Defines possible logo variants
}

const Logo: React.FC<LogoProps> = ({ variant = 'default' }) => {
  // Determine image sources based on the variant prop
  const getImageSources = () => {
    switch (variant) {
      case 'footer':
        return {
          src: '/images/footer/darkModeRectangularLogo200x100.png',
        };
      default:
        return {
          src: '/images/header/horizontalLogo100x38.png',
          srcSet:
            '/images/header/horizontalLogo125x47.png 125w, /images/header/horizontalLogo150x56.png 150w',
        };
    }
  };

  // Destructure the image sources from the function
  const { src, srcSet } = getImageSources();

  return (
    <div className="logo-container">
      <a href="/" className="logo-link" aria-label="Go to the homepage">
        <img
          src={src} // Main image source based on variant
          srcSet={srcSet} // Responsive image set based on variant
          sizes="(max-width: 480px) 100px, (max-width: 640px) 125px, 150px" // Define image sizes for different viewports
          alt="celebra-me.com" // Alt text for accessibility
        />
      </a>
    </div>
  );
};

export default Logo;
