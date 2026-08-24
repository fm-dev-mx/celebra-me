import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { victoriaInvitation } from '../../scripts/provision/invitations/victoria-y-roberto.ts';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release.ts';
import { adaptEvent } from '../../src/lib/adapters/event.ts';
import { parseEventContentData } from '../helpers/event-content-fixture.ts';

describe('Family Deceased Indicator Contract', () => {
	it('contains the deceased indicator span in Family.astro template', () => {
		const familyAstroPath = path.join(process.cwd(), 'src/components/invitation/Family.astro');
		const familyAstro = fs.readFileSync(familyAstroPath, 'utf8');

		expect(familyAstro).toContain('family__deceased-indicator');
		expect(familyAstro).toContain('†');
		expect(familyAstro).toContain('entry.deceased');
		expect(familyAstro).toContain('member.deceased');
	});

	it('proves Nicolas Luviano retains deceased: true in Victoria & Roberto family data model', () => {
		const publishedProjection = parseEventContentData(
			victoriaInvitation.buildPublishedContent(buildSemanticAssetMap(victoriaInvitation)),
		);

		expect(publishedProjection.family).toBeDefined();
		const groups = publishedProjection.family?.groups;
		expect(groups).toBeDefined();

		const robertoFamily = groups?.find((g) => g.title === 'Familia de Roberto');
		expect(robertoFamily).toBeDefined();

		const nicolas = robertoFamily?.items.find((item) => item.name === 'Nicolas Luviano');
		expect(nicolas).toMatchObject({
			name: 'Nicolas Luviano',
			role: 'Padre',
			deceased: true,
		});

		const viewModel = adaptEvent({
			id: 'events/victoria-y-roberto',
			collection: 'event-demos',
			data: publishedProjection,
		});

		const familySection = viewModel.sections.family;
		expect(familySection).toBeDefined();
		const vmRoberto = familySection?.groups?.find((g) => g.title === 'Familia de Roberto');
		expect(vmRoberto?.items).toContainEqual({
			name: 'Nicolas Luviano',
			role: 'Padre',
			deceased: true,
		});
	});
});
