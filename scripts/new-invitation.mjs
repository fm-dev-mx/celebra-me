#!/usr/bin/env node

const message = `
Blocked: pnpm ops new-invitation is disabled.

Real/client invitations are DB-published content, not static files under src/content/events.
Use the dashboard invitation workflow or a reviewed manifest-bearing production SQL patch.

Static content is reserved for demos/templates and explicit static fallbacks only.
See docs/domains/content/event-governance.md and .agent/rules/invitation-production.md.
`;

console.error(message.trim());
process.exit(1);
