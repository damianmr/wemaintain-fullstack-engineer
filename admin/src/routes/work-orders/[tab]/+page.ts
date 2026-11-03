import { error } from '@sveltejs/kit';
import { PAGE_SIZE, QUOTE_FILTER, TABS } from '#lib/labels.ts';
import type { QuoteFilter } from '#lib/types.ts';
import { listWorkOrders } from '#lib/work-orders/api.ts';


export const load = async ({ params, url, fetch }) => {
	const tab = params.tab as keyof typeof TABS;
	if (!TABS[tab]) error(404, `Unknown tab ${params.tab}`);
	const search = url.searchParams.get('search') ?? '';
	const withPriceList = url.searchParams.has('priced');
	const chargeable = url.searchParams.has('chargeable');
	const quoteParam = url.searchParams.get('quote') ?? '';
	const quote = quoteParam in QUOTE_FILTER ? (quoteParam as QuoteFilter) : null;
	const page = Number(url.searchParams.get('page') ?? 1);
	const result = await listWorkOrders(
		{ states: TABS[tab], search: search || undefined, withPriceList, chargeable, quote: quote ?? undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
		fetch
	);
	return { tab, search, withPriceList, chargeable, quote, page, ...result };
};
