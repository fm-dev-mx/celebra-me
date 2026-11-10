import { adaptEvent } from '@/lib/adapters/event';
import { contentDocumentFromEntry, type EventContentEntry } from '@/lib/content/events';
import { buildInvitationRenderPlan } from '@/lib/invitation/render-plan';
import { buildManagedPublishedContent } from '../helpers/managed-payload';

describe('XV Andrea guest memories section', () => {
	const content = buildManagedPublishedContent('andrea');

	it('publishes the memories card for the andrea space between the reply and the closing', () => {
		expect(content.memories).toMatchObject({ variant: 'card', publicSlug: 'andrea' });
		const order = content.sectionOrder as string[];
		expect(order.slice(-3)).toEqual(['rsvp', 'memories', 'thankYou']);
	});

	it('renders memories and lets the closing arch rise from it', () => {
		const viewModel = adaptEvent(
			contentDocumentFromEntry({ id: 'events/andrea', data: content } as EventContentEntry),
		);
		const plan = buildInvitationRenderPlan(viewModel);
		const sections = plan.map((item) => (item.type === 'section' ? item.section : item.type));
		expect(sections.slice(-3)).toEqual(['rsvp', 'memories', 'thankYou']);
		expect(
			plan.find((item) => item.type === 'section' && item.section === 'thankYou')
				?.intersection,
		).toEqual({ family: 'arch', source: 'memories' });
	});
});
