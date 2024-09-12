// src/components/ui/header/NavBarDesktop.tsx
// NavBarDesktop component handles the desktop navigation menu and renders navigation links dynamically.

import React, { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import ActionBase from '@/components/common/actions/ActionBase';
import type { HeaderData } from '@/config/landing.interface';
import Logo from '../Logo';

interface NavBarDesktopProps {
  data: HeaderData;
}

const NavBarDesktop: React.FC<NavBarDesktopProps> = ({ data }) => {
  const [currentPath, setCurrentPath] = useState<string>('');

  useEffect(() => {
    // Set the current path to highlight the active link based on the current location
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  return (
    <nav className="navbar-desktop">
      <div className="navbar-desktop-logo-wrapper">
        <Logo />
      </div>
      <div className="navbar-desktop-links-wrapper">
        <ul className="navbar-desktop-list">
          {data.links.map((item) => (
            <li key={item.href} className="navbar-desktop-item">
              <a
                href={item.href}
                className={twMerge(
                  'navbar-desktop-link',
                  currentPath === item.href ? 'active' : ''
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="navbar-desktop-cta-wrapper">
        <ActionBase
          variant="secondary"
          as="a"
          href="#"
          color="primary"
          className="navbar-desktop-cta"
        >
          Ver demos
        </ActionBase>
      </div>
    </nav>
  );
};

export default NavBarDesktop;
