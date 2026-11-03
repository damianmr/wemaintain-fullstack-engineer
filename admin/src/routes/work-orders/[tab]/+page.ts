import { error } from '@sveltejs/kit';
import { PAGE_SIZE, TABS } from '#lib/labels.ts';
import { listWorkOrders } from '#lib/work-orders/api.ts';


export const load = async ({ params, url, fetch }) => {
	const tab = params.tab as keyof typeof TABS;
	if (!TABS[tab]) error(404, `Unknown tab ${params.tab}`);
	const search = url.searchParams.get('search') ?? '';
	const withPriceList = url.searchParams.has('priced');
	// One state of the tab, or all of them.
	const state = TABS[tab].find((s) => s === url.searchParams.get('state')) ?? null;
	const page = Number(url.searchParams.get('page') ?? 1);
	const result = await listWorkOrders(
		{ states: state ? [state] : TABS[tab], search: search || undefined, withPriceList, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
		fetch
	);
	return { tab, search, withPriceList, state, page, ...result };
};
