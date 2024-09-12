// src/components/ui/Logo.tsx
// Logo component displays the main logo with its respective link and responsive image setup.
// This component ensures a clear and consistent branding display in the header.

import React from 'react';

const Logo: React.FC = () => {
  return (
    <div className="logo-container">
      <a href="/" className="logo-link" aria-label="Ir a la página principal">
        <img
          src="/images/header/horizontalLogo100x38.png"
          srcSet="/images/header/horizontalLogo125x47.png 125w, /images/header/horizontalLogo150x56.png 150w"
          sizes="(max-width: 480px) 100px, (max-width: 640px) 125px, 150px"
          alt="celebra-me.com"
        />
      </a>
    </div>
  );
};

export default Logo;
