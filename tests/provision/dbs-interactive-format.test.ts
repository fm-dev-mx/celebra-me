import { describe, expect, it } from '@jest/globals';
import { formatInvitationDetail } from '../../scripts/provision/dbs-interactive-format.ts';
import { buildInvitationChoices } from '../../scripts/provision/dbs-interactive-model.ts';
import { buildMediaOperationalPlan } from '../../scripts/provision/dbs-media-references.ts';
import { buildOperationalActionPlan } from '../../src/lib/status/action-plan.ts';
import type { MediaReferencesStatus } from '../../src/lib/status/media-reference-types.ts';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture.ts';

const media: MediaReferencesStatus = {
	preview: { status: 'MATCH', invitations: 1, references: 1, findings: [] },
	production: {
		status: 'REFERENCE_DRIFT',
		invitations: 1,
		references: 2,
		findings: [
			{
				route: 'boda/victoria-y-roberto',
				slug: 'victoria-y-roberto',
				path: 'hero.image',
				assetKey: 'hero',
				issue: 'REFERENCE_DRIFT',
			},
			{
				route: 'boda/victoria-y-roberto',
				slug: 'victoria-y-roberto',
				path: 'gallery.items[0].image',
				assetKey: 'gallery-01',
				issue: 'MISSING_ASSET',
			},
		],
	},
};

describe('dbs invitation detail presentation', () => {
	it('uses a clear hierarchy and semantic colors without changing the action plan', () => {
		const view = buildCanonicalStatusViewFixture();
		const choice = buildInvitationChoices(view, media)[0]!;
		const plan = buildMediaOperationalPlan(buildOperationalActionPlan(view), media);
		const plain = formatInvitationDetail({ choice, view, media, plan, env: { NO_COLOR: '1' } });
		expect(plain).toContain('ESTADO POR AMBIENTE');
		expect(plain).toContain('Producción');
		expect(plain).toContain('Publicación y referencias pendientes');
		expect(plain).toContain('1 asset(s) sin fila activa');
		expect(plain).toContain('PRÓXIMOS PASOS · solo lectura');
		expect(plain).toContain('pnpm invitation:media:verify');
		expect(plain).not.toContain('Solo si: Solo si');
		expect(plain).not.toContain('\x1b[');
		const colored = formatInvitationDetail({
			choice,
			view,
			media,
			plan,
			env: { FORCE_COLOR: '1' },
		});
		expect(colored).toContain('\x1b[32m');
		expect(colored).toContain('\x1b[33m');
		expect(colored).toContain('\x1b[31m');
	});

	it('avoids commands for event-type collisions', () => {
		const view = buildCanonicalStatusViewFixture({ promotions: [] });
		const collided: MediaReferencesStatus = {
			...media,
			production: {
				...media.production!,
				findings: [
					...media.production!.findings,
					{
						route: 'xv/victoria-y-roberto',
						slug: 'victoria-y-roberto',
						path: 'hero.image',
						assetKey: 'hero',
						issue: 'REFERENCE_DRIFT',
					},
				],
			},
		};
		const choice = buildInvitationChoices(view, collided)[0]!;
		const plan = buildMediaOperationalPlan(buildOperationalActionPlan(view), collided);
		const output = formatInvitationDetail({
			choice,
			view,
			media: collided,
			plan,
			env: { NO_COLOR: '1' },
		});
		expect(output).toContain('Slug compartido');
		expect(output).not.toContain('pnpm prod:apply');
	});
});
