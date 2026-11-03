import { error } from '@sveltejs/kit';
import { PAGE_SIZE, TABS } from '#lib/labels.ts';
import { listWorkOrders } from '#lib/work-orders/api.ts';


export const load = async ({ params, url, fetch }) => {
	const tab = params.tab as keyof typeof TABS;
	if (!TABS[tab]) error(404, `Unknown tab ${params.tab}`);
	const search = url.searchParams.get('search') ?? '';
	const withPriceList = url.searchParams.has('priced');
	const chargeable = url.searchParams.has('chargeable');
	const page = Number(url.searchParams.get('page') ?? 1);
	const result = await listWorkOrders(
		{ states: TABS[tab], search: search || undefined, withPriceList, chargeable, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
		fetch
	);
	return { tab, search, withPriceList, chargeable, page, ...result };
};
