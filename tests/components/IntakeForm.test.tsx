jest.mock('@/hooks/use-intake-form', () => ({
	useIntakeForm: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import IntakeForm from '@/components/intake/IntakeForm';
import { useIntakeForm } from '@/hooks/use-intake-form';

const mockUseIntakeForm = useIntakeForm as jest.MockedFunction<typeof useIntakeForm>;

beforeEach(() => {
	jest.clearAllMocks();
});

it('does not show the client review lock message for internal editing', () => {
	mockUseIntakeForm.mockReturnValue({
		currentStep: 0,
		currentBlockType: 'event-details',
		totalSteps: 0,
		blockData: {},
		errors: {},
		saving: false,
		submitting: false,
		submitted: false,
		saved: false,
		clientComments: '',
		setClientComments: jest.fn(),
		showSummary: false,
		isLocked: false,
		enabledBlocks: [],
		updateBlockField: jest.fn(),
		nextStep: jest.fn(),
		prevStep: jest.fn(),
		goToStep: jest.fn(),
		submit: jest.fn(),
	});

	render(
		<IntakeForm
			mode="admin"
			invitationId="proj-1"
			enabledBlocks={[]}
			initialBlockData={{}}
			initialStatus="approved"
			isLocked={false}
			invitationTitle="Invitación"
			eventType="xv"
		/>,
	);

	expect(screen.queryByText('Formulario en revision')).not.toBeInTheDocument();
	expect(screen.getByText('Edición interna')).toBeInTheDocument();
});
