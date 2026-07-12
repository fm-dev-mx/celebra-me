import type {
	CommercialDashboardRows,
	ConversionSummaryRow,
	SalesOrderSummaryRow,
} from '@/lib/tracking/commercial-dashboard';

export interface CommercialRecordClassification {
	record_type: 'lead' | 'customer' | 'sales_order' | 'meta_conversion_event';
	record_id: string;
}

export function excludeClassifiedTestRecords(
	rows: Pick<CommercialDashboardRows, 'leads'> & {
		orders: SalesOrderSummaryRow[];
		conversions: ConversionSummaryRow[];
	},
	classifications: CommercialRecordClassification[],
) {
	const classified = new Set(classifications.map((row) => `${row.record_type}:${row.record_id}`));
	const customerIsTest = (id?: string | null) => Boolean(id && classified.has(`customer:${id}`));
	const leadIsTest = (id?: string | null) => Boolean(id && classified.has(`lead:${id}`));
	return {
		leads: rows.leads.filter(
			(lead) => !leadIsTest(lead.id) && !customerIsTest(lead.customer_id),
		),
		orders: rows.orders.filter(
			(order) =>
				!classified.has(`sales_order:${order.id}`) &&
				!customerIsTest(order.customer_id) &&
				!leadIsTest(order.lead_id),
		),
		conversions: rows.conversions.filter(
			(conversion) =>
				!classified.has(`meta_conversion_event:${conversion.id}`) &&
				!customerIsTest(conversion.customer_id) &&
				!classified.has(`sales_order:${conversion.order_id}`) &&
				!leadIsTest(conversion.lead_id),
		),
	};
}
