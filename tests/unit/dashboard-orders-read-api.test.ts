/** @jest-environment node */
jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
	requireAdminMutationAccess: jest.fn(),
}));
jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({ requireAdminRateLimit: jest.fn() }));
jest.mock('@/lib/commercial/orders.service', () => ({ createCommercialSalesOrder: jest.fn() }));
jest.mock('@/lib/commercial/customer.service', () => ({ createCommercialCustomer: jest.fn() }));
jest.mock('@/lib/commercial/orders.repository', () => ({
	listCommercialSalesOrders: jest.fn(),
	findSalesOrdersByCustomerId: jest.fn(),
}));
jest.mock('@/lib/commercial/customer.repository', () => ({
	findCommercialCustomerByPhone: jest.fn(),
	findCommercialCustomerByEmail: jest.fn(),
	findCommercialCustomerById: jest.fn(),
}));

import { GET as orders } from '@/pages/api/dashboard/commercial/orders';
import { GET as customers } from '@/pages/api/dashboard/commercial/customers';
import { listCommercialSalesOrders } from '@/lib/commercial/orders.repository';
import {
	findCommercialCustomerByPhone,
	findCommercialCustomerByEmail,
} from '@/lib/commercial/customer.repository';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createApiContext } from '../helpers/api-mocks';

const context = (path: string) =>
	createApiContext(new Request(`https://example.test/api/dashboard/commercial/${path}`)) as never;
beforeEach(() => {
	jest.resetAllMocks();
	jest.mocked(listCommercialSalesOrders).mockResolvedValue({ items: [], nextOffset: null });
});

test('lists a bounded page with server-side status selection', async () => {
	expect((await orders(context('orders?view=orders&status=partial&offset=50'))).status).toBe(200);
	expect(listCommercialSalesOrders).toHaveBeenCalledWith(50, 'partial');
	expect(requireAdminRateLimit).toHaveBeenCalled();
});
test.each(['offset=-1', 'offset=1.5', 'offset=no', 'status=unknown'])(
	'rejects invalid page/filter %s',
	async (query) => {
		expect((await orders(context(`orders?view=orders&${query}`))).status).toBe(400);
		expect(listCommercialSalesOrders).not.toHaveBeenCalled();
	},
);
test('denies customer and order reads before accessing their repositories', async () => {
	jest.mocked(requireAdminStrongSession).mockRejectedValue(
		new ApiError(403, 'forbidden', 'Sin acceso'),
	);
	expect((await orders(context('orders?view=orders'))).status).toBe(403);
	expect((await customers(context('customers?phone=6681234567'))).status).toBe(403);
	expect(listCommercialSalesOrders).not.toHaveBeenCalled();
	expect(findCommercialCustomerByPhone).not.toHaveBeenCalled();
});
test('finds standalone customers by canonical phone or email and deduplicates', async () => {
	const customer = { id: 'c1', displayName: 'Cliente de prueba' };
	jest.mocked(findCommercialCustomerByPhone).mockResolvedValue(customer);
	jest.mocked(findCommercialCustomerByEmail).mockResolvedValue(customer);
	const response = await customers(
		context('customers?phone=6681234567&email=CLIENTE@example.test'),
	);
	expect(await response.json()).toMatchObject({ data: [customer] });
	expect(findCommercialCustomerByPhone).toHaveBeenCalledWith('+526681234567');
	expect(findCommercialCustomerByEmail).toHaveBeenCalledWith('cliente@example.test');
});
