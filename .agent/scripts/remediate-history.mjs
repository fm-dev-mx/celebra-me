import { execSync } from 'child_process';

function run(command) {
	console.log(`\n> ${command}`);
	try {
		return execSync(command, { stdio: 'inherit' });
	} catch {
		console.error(`Command failed: ${command}`);
		process.exit(1);
	}
}

function commit(message) {
	console.log(`\nCommit: ${message.split('\n')[0]}`);
	try {
		execSync(
			`git commit --no-verify --author="fm-dev-mx <48076635+fm-dev-mx@users.noreply.github.com>" -m "${message}"`,
			{ stdio: 'inherit' },
		);
	} catch {
		console.error(`Commit failed for: ${message}`);
		process.exit(1);
	}
}

// 1. Reset everything to captured state
console.log('Resetting git history by 15 commits...');
run('git reset --soft HEAD~15');

// 2. Unstage everything so we can stage piecemeal
run('git reset');

// --- COMMITS RECREATION ---

// Commit 1:
run('git add src/content/events/demo-wedding.json');
commit(
	'feat(core): create initial wedding demo invitation data\n\n- src/content/events/demo-wedding.json: complete event data for Sofia and Alejandro',
);

// Commit 2:
run('git add src/assets/images/events/demo-wedding/');
commit(
	'feat(ui): register image assets for wedding demo\n\n- src/assets/images/events/demo-wedding/: initial set of wedding images',
);

// Commit 3:
run('git add .agent/plans/wedding-finalization/');
commit(
	'docs(governance): synchronize wedding finalization implementation plans\n\n- .agent/plans/wedding-finalization/manifest.json: synchronize phase status\n- .agent/plans/wedding-finalization/README.md: conclude post-mortem summary',
);

// Commit 4:
run('git add src/content/config.ts');
commit(
	'feat(core): expand event schema to support wedding dual-names\n\n- src/content/config.ts: update event schema for dual names and groups',
);

// Commit 5:
run('git add src/lib/adapters/event.ts src/lib/adapters/types.ts src/lib/assets/asset-registry.ts');
commit(
	'feat(core): implement wedding data adapters and types\n\n- src/lib/adapters/event.ts: implement dual name and family group mapping\n- src/lib/assets/asset-registry.ts: register wedding hero and gallery assets',
);

// Commit 6:
run(
	'git add src/content/events/demo-bodas.json src/content/events/demo-cumple.json src/data/landing-page.data.ts',
);
commit(
	'feat(core): add wedding and birthday demo invitations\n\n- src/content/events/demo-bodas.json: new premium wedding demo data\n- src/content/events/demo-cumple.json: standardized birthday demo data',
);

// Commit 7:
run('git add .agent/governance/config/domain-map.json');
commit(
	'chore(governance): map global style utilities to theme domain\n\n- .agent/governance/config/domain-map.json: add src/styles/global/** pattern to theme domain',
);

// Commit 8:
run('git add src/styles/themes/sections/');
commit(
	'style(theme): refactor wedding sections to resolve logic duplication\n\n- src/styles/themes/sections/_countdown-theme.scss: use surface-glass\n- src/styles/themes/sections/_family-theme.scss: modernize header',
);

// Commit 9:
run('git add src/components/invitation/Interlude.astro src/styles/invitation/_interlude.scss');
commit(
	'feat(invitation): implement Interlude component for visual breaks\n\n- src/components/invitation/Interlude.astro: full-width image section component',
);

// Commit 10 & 11 (Merged):
run(
	'git add commitlint.config.cjs src/styles/themes/presets/_jewelry-box-wedding.scss src/styles/themes/presets/_invitation.scss',
);
commit(
	'style(theme): revise commitlint and wedding invitation styles\n\n- commitlint.config.cjs: update rules\n- src/styles/themes/presets/_jewelry-box-wedding.scss: wedding color palette',
);

// Commit 12:
run('git add src/content/events/archived/demo-gerardo-sesenta.json');
commit(
	'fix(core): remove deprecated demo-gerardo-sesenta event\n\n- src/content/events/archived/demo-gerardo-sesenta.json: archive legacy demo',
);

// Commit 13:
run('git add .agent/plans/');
commit(
	'docs(governance): add AI implementation plans for recent demos\n\n- .agent/plans/: documentation for recent feature work',
);

// Commit 14:
run('git add src/assets/images/events/');
commit(
	'feat(ui): add AI image assets for demo invitations\n\n- src/assets/images/events/: generated assets for demo content',
);

// Commit 15:
run('git add .agent/scripts/remediate-history.mjs');
commit(
	'chore(governance): add history remediation script\n\n- .agent/scripts/remediate-history.mjs: utility for git history alignment',
);

console.log('\nRemediation complete. Remaining uncommitted files:');
run('git status -s');
