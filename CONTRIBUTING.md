# Contributing to Celebra-me.com

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to Celebra-me.com, which is hosted on
[GitHub](https://github.com/fm-dev-mx/celebra-me). These are mostly guidelines, not rules. Use your
best judgment, and feel free to propose changes to this document in a pull request.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for Celebra-me.com. Following these
guidelines helps maintainers and the community understand your report, reproduce the behavior, and
find related reports.

Before creating a bug report, please check if the issue has already been reported by searching the
[issues](https://github.com/fm-dev-mx/celebra-me/issues). When you create a bug report, provide as
much detail as possible.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Celebra-me.com, including
completely new features and minor improvements to existing functionality. When you are creating an
enhancement suggestion, please include as much detail as possible.

### Pull Requests

The process described here has several goals:

- Maintain Celebra-me.com's quality.
- Fix problems that are important to users.
- Engage the community in working toward the best possible product.

Please follow these steps to have your contribution considered by the maintainers:

1. Fork the repository.
2. Create a branch from the `main` branch for your feature (`git checkout -b feature-name`).
3. Make your changes, ensuring that you follow the coding style guidelines (below).
4. Commit your changes (`git commit -m 'Add some feature'`).
5. Push to the branch (`git push origin feature-name`).
6. Create a new pull request, following the pull request template provided.

### Coding Style

Please follow these coding standards:

- **Code Formatting**: Use Prettier for code formatting. The configuration is already set up in
  `.prettierrc.mjs`.
- **Linting**: Use ESLint for identifying and reporting on patterns in JavaScript. The configuration
  is already set up in `.eslintrc.cjs`.
- **Type Safety**: Ensure type safety with TypeScript.
- **Commit Messages**: Follow conventional commits for your commit messages.

### Development Environment

To set up the development environment:

1. Ensure you have the latest LTS version of Node.js installed.
2. Use pnpm as the package manager. Install pnpm if you don't have it installed:

    ```bash
    pnpm install -g pnpm
    ```

3. Clone the repository:

    ```bash
    git clone https://github.com/fm-dev-mx/celebra-me.git
    cd celebra-me
    ```

4. Install dependencies:

    ```bash
    pnpm install
    ```

5. Run the development server:

    ```bash
    pnpm dev
    ```

## Thank You

Thank you for considering contributing to Celebra-me.com! Your contributions help make it an even
better platform for creating beautiful, personalized digital invitations.
