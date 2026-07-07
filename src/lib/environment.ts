/**
 * Test-safe development-environment check.
 *
 * Wraps `import.meta.env.DEV` so that test files can mock this module
 * without Jest choking on the `import.meta.env` syntax.
 */
export function isDevEnvironment(): boolean {
  return import.meta.env.DEV;
}
