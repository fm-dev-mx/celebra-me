export interface FooterProps {
  siteInfo: {
    slogan?: string;
  };
  linkGroups: Array<{
    title: string;
    links: Array<{
      label: string;
      href: string;
      isExternal?: boolean;
    }>;
  }>;
  socialLinks?: {
    links: Array<{
      label: string;
      href: string;
      icon?: string;
    }>;
  };
}
