# Celebra-me.com: Digital Invitations Made Easy

![Celebra-me Logo](public/icons/favicon.svg)

This is a personal project where I, Francisco Mendoza, specialize in creating
and offering personalized digital invitations for various events.
Leveraging modern web technologies like Astro, TypeScript, and TailwindCSS,
I provide a seamless experience to ensure your events are unforgettable.

## Key Features

- **Elegant and Original Designs**:
Unique, professionally crafted designs tailored for various events.
- **Ease of Use**:
Designed with user-friendliness in mind, our invitations are simple to interact with,
even for non-tech-savvy guests.
- **Responsiveness**:
Optimized for all devices, ensuring a seamless experience on
smartphones, tablets, and desktops.

## Technologies Used

- **Astro**: A modern, fast, and efficient web framework for building static websites.
- **TypeScript**: Ensuring type safety and robust code quality.
- **TailwindCSS**: For rapid UI development with a focus on customizability and responsiveness.
- **ESLint & Prettier**: Maintaining code quality and consistency across the project.
- **CSpell**: For spell checking and ensuring textual accuracy.

## Project Structure

```plaintext
celebra-me
├── public      # Public assets accessible directly by the browser
│   ├── hero_section            # Images and assets for the hero section
│   └── testimonials            # Images for testimonials
├── src                       # Source code of the project
│   ├── components             # Reusable UI components
│   │   ├── Action.astro        # Action button component
│   │   ├── Icon.astro          # Icon component
│   │   ├── IconWrapper.astro   # Icon wrapper component
│   │   └── SectionTitle.astro   # Section title component
│   ├── config                 # Configuration files
│   │   └── landing.interface.ts   # TypeScript interface for landing data
│   ├── data                   # Data files in JSON format
│   │   └── landing.json        # Landing page data
│   ├── icons                  # Icon components categorized by use
│   │   ├── aboutUs             # Icons for the About Us section
│   │   ├── commons            # Commonly used icons across the site
│   │   ├── pricing             # Icons for the pricing section
│   │   └── services   # Icons for invitation services
│   ├── pages                  # Page components for the site
│   │   └── index.astro         # Index page component
│   └── sections               # Section components for the landing page
│       ├── About-us.astro      # About Us section component
│       ├── Header.astro        # Header component
│       ├── Hero.astro          # Hero section component
│       ├── Pricing.astro       # Pricing section component
│       ├── Services.astro      # Services section component
│       └── Footer.astro        # Footer component
├── .editorconfig              # Editor configuration for consistent coding styles
├── .eslintrc.cjs              # ESLint configuration
├── .prettierrc.mjs            # Prettier configuration for code formatting
└── README.md                  # Project documentation
```

## Getting Started

### Prerequisites

- **Node.js**: Ensure you have the latest LTS version installed.
- **pnpm**: Preferred package manager for this project.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/fm-dev-mx/celebra-me.git
   cd celebra-me
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the development server:

   ```bash
   pnpm dev
   ```

### Building for Production

```bash
pnpm build
```

## Contribution Guidelines

I welcome contributions to help improve this project!
Please read the [Contributing Guide](/CONTRIBUTING.md)
to learn about the development process, how to propose bug fixes and improvements,
and how to build and test your changes.

## Connect with Me

[![LinkedIn](public/icons/linkedInIcon.svg)](https://www.linkedin.com/in/francisco-mendoza-ordn/)
[linkedin.com/in/francisco-mendoza-ordn](https://www.linkedin.com/in/francisco-mendoza-ordn/)

[![GitHub](public/icons/githubIcon.svg)](https://github.com/fm-dev-mx)
[github.com/fm-dev-mx](https://github.com/fm-dev-mx/)
