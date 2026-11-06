jest.mock('@/lib/commercial/orders.repository', () => ({
	createSalesOrder: jest.fn(),
	registerSalesOrderDepositPurchase: jest.fn(),
	findSalesOrderByIdempotencyKey: jest.fn(),
	redeemCustomerReferralCredit: jest.fn(),
}));

jest.mock('@/lib/commercial/customer.repository', () => ({
	findCommercialCustomerById: jest.fn(),
	findCommercialCustomerByReferralCode: jest.fn(),
}));

jest.mock('@/lib/commercial/meta-capi/service', () => ({
	deliverMetaConversionEvent: jest.fn(),
}));

jest.mock('@/lib/commercial/commercial-tracking', () => ({
	emitCommercialTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/tracking/lead.repository', () => ({
	findLeadOrderAttribution: jest.fn(),
	markLeadAsPastSale: jest.fn(),
}));

jest.mock('@/lib/commercial/meta-capi/lead-stage-events', () => ({
	enqueueMetaCrmLeadStageEvent: jest.fn(),
}));

import {
	createSalesOrder,
	findSalesOrderByIdempotencyKey,
	redeemCustomerReferralCredit,
	registerSalesOrderDepositPurchase,
} from '@/lib/commercial/orders.repository';
import {
	findCommercialCustomerById,
	findCommercialCustomerByReferralCode,
} from '@/lib/commercial/customer.repository';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import { findLeadOrderAttribution, markLeadAsPastSale } from '@/lib/tracking/lead.repository';
import { enqueueMetaCrmLeadStageEvent } from '@/lib/commercial/meta-capi/lead-stage-events';
import {
	createCommercialSalesOrder,
	markCommercialOrderDepositPaid,
} from '@/lib/commercial/orders.service';
import {
	applyReferrerCreditPricing,
	buildCustomerReferralLink,
	buildMetaCustomerListCsv,
	buildPastClientReferralWhatsAppMessage,
	calculateFriendReferralPricing,
	normalizeReferralCode,
	readReferralCodeFromUrl,
} from '@/lib/commercial/referrals';

const mockCreateSalesOrder = jest.mocked(createSalesOrder);
const mockRegisterDeposit = jest.mocked(registerSalesOrderDepositPurchase);
const mockFindByKey = jest.mocked(findSalesOrderByIdempotencyKey);
const mockRedeem = jest.mocked(redeemCustomerReferralCredit);
const mockFindCustomer = jest.mocked(findCommercialCustomerById);
const mockFindReferrer = jest.mocked(findCommercialCustomerByReferralCode);
const mockFindAttribution = jest.mocked(findLeadOrderAttribution);

const baseOrderInput = {
	customerId: 'friend-id',
	eventType: 'boda',
	packageName: 'Premium',
	totalAmount: 1800,
	depositAmount: 900,
};

const createdOrder = {
	id: 'order-id',
	orderNumber: 'CMO-20261102-ABC123',
	customerId: 'friend-id',
	leadId: 'lead-id',
	sessionId: null,
	status: 'confirmed' as const,
	totalAmount: 1620,
	wasCreated: true,
};

function createdOrderInput() {
	return mockCreateSalesOrder.mock.calls[0][0];
}

beforeEach(() => {
	jest.clearAllMocks();
	mockFindByKey.mockResolvedValue(null);
	mockRedeem.mockResolvedValue(true);
	mockFindCustomer.mockResolvedValue(null);
	mockFindReferrer.mockResolvedValue(null);
	mockFindAttribution.mockResolvedValue(null);
	jest.mocked(markLeadAsPastSale).mockResolvedValue(undefined);
	mockCreateSalesOrder.mockResolvedValue(createdOrder as never);
});

describe('past sales', () => {
	it('registers a past sale with its real date, no rewards and the lead flagged as past', async () => {
		mockFindAttribution.mockResolvedValue({ leadId: 'lead-id', sessionId: null } as never);
		mockFindReferrer.mockResolvedValue({ id: 'referrer-id' } as never);

		await createCommercialSalesOrder({
			...baseOrderInput,
			leadId: 'lead-id',
			isPastSale: true,
			soldAt: '2026-03-14T12:00:00.000Z',
			referralCodeUsed: 'ana24',
		});

		expect(createdOrderInput()).toEqual(
			expect.objectContaining({
				isPastSale: true,
				soldAt: '2026-03-14T12:00:00.000Z',
				totalAmount: 1800,
				discountAmount: 0,
				referrerCreditRedeemed: 0,
			}),
		);
		expect(mockFindCustomer).not.toHaveBeenCalled();
		expect(mockRedeem).not.toHaveBeenCalled();
		expect(markLeadAsPastSale).toHaveBeenCalledWith('lead-id');
	});

	it('enqueues no Meta Purchase or CRM stage event when a past sale deposit is marked paid', async () => {
		mockRegisterDeposit.mockResolvedValue({
			order: { ...createdOrder, status: 'deposit_paid', isPastSale: true, amountPaid: 900 },
			conversionEvent: null,
			idempotent: false,
		} as never);

		const result = await markCommercialOrderDepositPaid({
			orderId: 'order-id',
			amountPaid: 900,
		});

		expect(result.conversionEvent).toBeNull();
		expect(deliverMetaConversionEvent).not.toHaveBeenCalled();
		expect(enqueueMetaCrmLeadStageEvent).not.toHaveBeenCalled();
	});
});

describe('referral rewards on new sales', () => {
	it('gives the referred friend 10% off and stores the code and referrer', async () => {
		mockFindReferrer.mockResolvedValue({ id: 'referrer-id' } as never);

		await createCommercialSalesOrder({ ...baseOrderInput, referralCodeUsed: ' ana24 ' });

		expect(createdOrderInput()).toEqual(
			expect.objectContaining({
				isPastSale: false,
				referredByCustomerId: 'referrer-id',
				referralCodeUsed: 'ANA24',
				discountAmount: 180,
				totalAmount: 1620,
			}),
		);
	});

	it('never lets a customer refer themselves', async () => {
		mockFindReferrer.mockResolvedValue({ id: 'friend-id' } as never);

		await createCommercialSalesOrder({ ...baseOrderInput, referralCodeUsed: 'ANA24' });

		expect(createdOrderInput()).toEqual(
			expect.objectContaining({ referredByCustomerId: undefined, discountAmount: 0 }),
		);
	});

	it('spends the referrer credit on their own next order and redeems it once', async () => {
		mockFindCustomer.mockResolvedValue({ id: 'friend-id', referralCreditMxn: 400 } as never);

		await createCommercialSalesOrder({ ...baseOrderInput, idempotencyKey: 'key-1' });

		expect(createdOrderInput()).toEqual(
			expect.objectContaining({
				idempotencyKey: 'key-1',
				discountAmount: 400,
				referrerCreditRedeemed: 400,
				totalAmount: 1400,
			}),
		);
		expect(mockRedeem).toHaveBeenCalledWith('friend-id', 400);
	});

	it('returns the stored order on a replay without spending the credit again', async () => {
		mockFindByKey.mockResolvedValue(createdOrder as never);

		const order = await createCommercialSalesOrder({
			...baseOrderInput,
			idempotencyKey: 'key-1',
		});

		expect(order.wasCreated).toBe(false);
		expect(mockCreateSalesOrder).not.toHaveBeenCalled();
		expect(mockRedeem).not.toHaveBeenCalled();
	});
});

describe('referral helpers', () => {
	it('normalizes referral codes and reads ?ref from links', () => {
		expect(normalizeReferralCode(' ana24 ')).toBe('ANA24');
		expect(normalizeReferralCode('a-1')).toBeUndefined();
		expect(readReferralCodeFromUrl('https://celebra-me.com/?ref=ana24')).toBe('ANA24');
		expect(buildCustomerReferralLink('ana24')).toMatch(/\/\?ref=ANA24$/);
	});

	it('prices the friend discount and the referrer credit with a $1 floor', () => {
		expect(calculateFriendReferralPricing(1799)).toEqual({
			basePrice: 1799,
			discountAmount: 180,
			netTotalAmount: 1619,
		});
		expect(applyReferrerCreditPricing(150, 200)).toEqual({
			basePrice: 150,
			discountAmount: 149,
			netTotalAmount: 1,
		});
	});

	it('writes the WhatsApp message in usted, with updated prices and never $499', () => {
		const message = buildPastClientReferralWhatsAppMessage({
			customerName: 'Gloria',
			referralCode: 'GLOR24',
		});

		expect(message).toContain('precios actualizados');
		expect(message).toContain('?ref=GLOR24');
		expect(message).toContain('usted acumula $200 MXN');
		expect(message).not.toContain('499');
		expect(message).not.toMatch(/\btú\b|\btu enlace\b/i);
	});

	it('builds the Meta CSV with E.164 phones only, deduplicated, MX by default', () => {
		const csv = buildMetaCustomerListCsv([
			{ displayName: 'Ana Pérez', phoneE164: '+526681112233', city: 'Culiacán' },
			{ displayName: 'Ana P.', phoneE164: '+526681112233' },
			{ displayName: 'Sin Teléfono', phoneE164: null },
		]);

		expect(csv).toBe(
			'phone,fn,ln,ct,st,country\n+526681112233,Ana,Pérez,Culiacán,Sinaloa,MX\n',
		);
	});

	it('writes a Mexican city under its canonical name with its state, others as stored', () => {
		const csv = buildMetaCustomerListCsv([
			{ displayName: 'Luis Soto', phoneE164: '+526561112233', city: 'cd juarez' },
			{ displayName: 'Eva Ruiz', phoneE164: '+526561112244', city: 'Guadalupe, Zac.' },
			{ displayName: 'Ann Lee', phoneE164: '+19155550101', city: 'El Paso', country: 'us' },
			{ displayName: 'Rosa Gil', phoneE164: '+526561112255', city: 'Villa Ahumada' },
		]);

		expect(csv).toBe(
			[
				'phone,fn,ln,ct,st,country',
				'+526561112233,Luis,Soto,Ciudad Juárez,Chihuahua,MX',
				'+526561112244,Eva,Ruiz,Guadalupe,Zacatecas,MX',
				'+19155550101,Ann,Lee,El Paso,,US',
				'+526561112255,Rosa,Gil,Villa Ahumada,,MX',
				'',
			].join('\n'),
		);
	});
});
