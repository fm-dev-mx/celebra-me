// src/components/ui/header/NavBarMobile.tsx
// NavBarMobile component handles the mobile navigation menu and renders navigation links dynamically.
import React, { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import Icon from '@/components/common/Icon';
import ActionBase from '@/components/common/actions/ActionBase';
import type { HeaderData } from '@/config/landing.interface';
import Logo from '../Logo';
import { useToggleMobileMenu } from '@/hooks/header/useToggleMobileMenu';

// Props interface for NavBarMobile component
interface NavBarMobileProps {
  data: HeaderData; // Contains the data for rendering the navigation links
}

// Functional component for mobile navigation bar
const NavBarMobile: React.FC<NavBarMobileProps> = ({ data }) => {
  // Destructure state and toggle function from custom hook
  const { isMobileMenuOpen, toggleMobileMenu } = useToggleMobileMenu();

  // State to keep track of the current path for active link highlighting
  const [currentPath, setCurrentPath] = useState<string>('');

  useEffect(() => {
    // Update currentPath when the component mounts
    // Ensure window is defined (client-side rendering check)
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  return (
		<div className={`navbar-mobile ${isMobileMenuOpen ? 'hidden' : 'block'}`}>
      {/* Mobile menu header with logo and toggle button */}
      <div className="navbar-mobile-header">
        <Logo />
        <button
          id="mobile-menu-button"
          className="menu-button"
          aria-label="Toggle mobile menu" // Accessibility label
          onClick={toggleMobileMenu} // Toggle the mobile menu visibility
        >
          <Icon icon={isMobileMenuOpen ? "CloseIcon" : "MenuIcon"} />
        </button>
      </div>

      {/* Mobile menu content */}
      <div
        id="mobile-menu"
        className={twMerge(
          'mobile-menu',
          isMobileMenuOpen ? 'mobile-menu-open' : 'hidden' // Show/hide menu based on state
        )}
      >
        <nav className="mobile-menu-nav">
          <ul className="mobile-menu-list">
            {/* Render list items based on data.links */}
            {data.links.map((item) => (
              <li key={item.href} className="mobile-menu-item">
                <a
                  href={item.href}
                  className={twMerge(
                    'mobile-menu-link',
                    currentPath === item.href ? 'active' : '' // Highlight active link
                  )}
                  onClick={toggleMobileMenu} // Close menu on link click
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Call-to-action button */}
          <div className="mobile-menu-cta">
            <ActionBase
              variant="secondary"
              color="secondary"
              as="a"
              href="#"
              className="cta-button-mobile"
              onClick={toggleMobileMenu} // Close menu on button click
            >
              Ver demos
            </ActionBase>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default NavBarMobile;
