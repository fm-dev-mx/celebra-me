import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'fs'; // wait, no globSync by default, use custom
import { join } from 'path';

const filesToFix = [
  'docs/RSVP_STATUS.md',
  'docs/STABILITY.md',
  'docs/DOC_STATUS.md',
  'docs/audit/rsvp-v2-gap-analysis-2026-02-15.md',
  'docs/audit/rsvp-v2-verification-2026-02-15.md'
];

for (const f of filesToFix) {
  try {
    let text = readFileSync(f, 'utf8');
    text = text.replace(/src\/pages\/admin\/rsvp\.astro/g, 'src/pages/dashboard/admin.astro');
    text = text.replace(/src\/pages\/api\/rsvp\/admin\.ts/g, 'src/pages/api/dashboard/admin/events.ts');
    text = text.replace(/src\/pages\/api\/rsvp\/export\.csv\.ts/g, 'src/pages/api/dashboard/admin/export.ts');
    text = text.replace(/src\/pages\/api\/rsvp\/invitations\.ts/g, 'src/pages/api/invitacion/rsvp.ts');
    text = text.replace(/src\/lib\/rsvp\/adminAuth\.ts/g, 'src/lib/rsvp/adminProtection.ts');
    text = text.replace(/\.agent\/gatekeeper\/policy\.json/g, '.agent/governance/config/policy.json');
    text = text.replace(/\.agent\/gatekeeper\/baseline\.json/g, '.agent/governance/config/baseline.json');
    text = text.replace(/\.agent\/workflows\/docs/g, '.agent/workflows/evergreen');

    writeFileSync(f, text);
    console.log('Fixed', f);
  } catch (e) {
    console.error('Failed to fix', f, e.message);
  }
}
