// src/components/ui/header/NavBarMobile.tsx
// NavBarMobile component handles the mobile navigation menu, toggle button, and renders links dynamically.

import React, { useState, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';
import Icon from '@/components/common/Icon';
import ActionBase from '@/components/common/actions/ActionBase';
import type { HeaderData } from '@/config/landing.interface';
import Logo from '../Logo';

interface NavBarMobileProps {
  data: HeaderData;
}

const NavBarMobile: React.FC<NavBarMobileProps> = ({ data }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');

  useEffect(() => {
    // Set the current path to highlight the active link
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  // Toggle the mobile menu visibility
  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
    // Prevent scrolling when menu is open
    document.body.style.overflow = menuOpen ? 'auto' : 'hidden';
  };

  return (
    <div className="navbar-mobile">
      <div className="navbar-mobile-header">
        <Logo />
        {/* Mobile menu button */}
        <button
          id="mobile-menu-button"
          className="menu-button"
          aria-label="Toggle mobile menu"
          onClick={toggleMenu}
        >
          <Icon icon={menuOpen ? "CloseIcon" : "MenuIcon"} />
        </button>
      </div>

      {/* Mobile navigation menu */}
      <div
        id="mobile-menu"
        className={twMerge(
          'mobile-menu',
          menuOpen ? 'mobile-menu-open' : ''
        )}
      >
        <nav className="mobile-menu-nav">
          <ul className="mobile-menu-list">
            {data.links.map((item) => (
              <li key={item.href} className="mobile-menu-item">
                <a
                  href={item.href}
                  className={twMerge(
                    'mobile-menu-link',
                    currentPath === item.href ? 'active' : ''
                  )}
                  onClick={toggleMenu}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Mobile CTA Button */}
          <div className="mobile-menu-cta">
            <ActionBase
              variant="primary"
              color="primary"
              as="a"
              href="#"
              className="cta-button-mobile"
              onClick={toggleMenu}
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
