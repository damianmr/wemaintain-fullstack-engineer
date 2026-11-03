<script lang="ts">
	import { goto } from '$app/navigation';
	import { date } from '#lib/format.ts';
	import { PAGE_SIZE, QUOTE_FILTER, STATE, TABS, URGENCY, quoteStatusPill } from '#lib/labels.ts';
	import Pill from '#lib/ui/Pill.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pages = $derived(Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)));
	/** The list's filters as URL parameters, kept across tabs and pages. The state belongs to its tab, so pages keep it and tabs do not. */
	const query = (extra: Record<string, string> = {}) => {
		const params = new URLSearchParams({ ...(data.search && { search: data.search }), ...(data.withPriceList && { priced: '1' }), ...(data.chargeable && { chargeable: '1' }), ...(data.quote && { quote: data.quote }), ...extra });
		return params.size ? `?${params}` : '';
	};
</script>

<h1>Work orders</h1>

<form class="filters" method="GET">
	<input name="search" value={data.search} placeholder="Search by number, title or client" />
	{#if TABS[data.tab].length > 1}
		<select name="state" value={data.state ?? ''} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">All states</option>
			{#each TABS[data.tab] as state (state)}
				<option value={state}>{STATE[state][0]}</option>
			{/each}
		</select>
	{/if}
	<select name="quote" value={data.quote ?? ''} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
		<option value="">Any quote</option>
		{#each Object.entries(QUOTE_FILTER) as [value, label] (value)}
			<option {value}>{label}</option>
		{/each}
	</select>
	<label>
		<input type="checkbox" name="priced" value="1" checked={data.withPriceList} onchange={(e) => e.currentTarget.form?.requestSubmit()} />
		Only contracts with a price list
	</label>
	<label>
		<input type="checkbox" name="chargeable" value="1" checked={data.chargeable} onchange={(e) => e.currentTarget.form?.requestSubmit()} />
		Only chargeable
	</label>
</form>

<nav class="tabs">
	{#each Object.keys(TABS) as tab (tab)}
		<a href="/work-orders/{tab}{query()}" class:active={tab === data.tab}>{tab[0].toUpperCase() + tab.slice(1)}</a>
	{/each}
</nav>

<div class="card">
	<table>
		<thead>
			<tr><th>Date</th><th>Work order</th><th>Site - Unit</th><th>Client</th><th>Status</th><th>Quote</th><th>Urgency</th></tr>
		</thead>
		<tbody>
			{#each data.items as wo (wo.id)}
				<tr onclick={() => goto(`/work-orders/details/${wo.workOrderNumber}`)}>
					<td>{date(wo.createdAt)}</td>
					<td><strong>{wo.workOrderNumber}</strong><div>{wo.title ?? ''}</div></td>
					<td>
						<div>{wo.device?.deviceNo}</div>
						<div class="grey">{wo.device?.building.name}, {wo.device?.building.city}</div>
					</td>
					<td>
						<div>{wo.device?.building.customer.companyName}</div>
						<div class="grey">{wo.device?.contracts[0]?.contract.type ?? ''}</div>
					</td>
					<td><Pill theme={STATE[wo.state][1]}>{STATE[wo.state][0]}</Pill></td>
					<td>
						{#if wo.quoteDraftId}<Pill theme="success">Quote draft</Pill>{/if}
						{#if wo.quoteNumber}
							<div>{wo.quoteNumber}</div>
							<div class="grey">{quoteStatusPill(wo.quoteStatus, [])[0]}</div>
						{:else if !wo.quoteDraftId}
							<span class="grey">No quote</span>
						{/if}
					</td>
					<td class="urgency">{URGENCY[wo.urgencyLevel]}</td>
				</tr>
			{:else}
				<tr><td colspan="7" class="grey">No work orders</td></tr>
			{/each}
		</tbody>
	</table>
	<footer>
		<span class="grey">{data.totalCount} work orders</span>
		<span class="pager">
			{#if data.page > 1}<a href={query({ ...(data.state && { state: data.state }), page: String(data.page - 1) })}>‹ Previous</a>{/if}
			<span>Page {data.page} / {pages}</span>
			{#if data.page < pages}<a href={query({ ...(data.state && { state: data.state }), page: String(data.page + 1) })}>Next ›</a>{/if}
		</span>
	</footer>
</div>

<style>
	h1 {
		font-size: 22px;
		margin: 0 0 16px;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: center;
		margin-bottom: 12px;
	}
	.filters input[name='search'] {
		width: 320px;
	}
	.filters label {
		display: flex;
		gap: 6px;
		align-items: center;
		white-space: nowrap;
	}
	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 12px;
	}
	.tabs a {
		padding: 6px 14px;
		border-radius: 6px;
		color: #3a4256;
	}
	.tabs a.active {
		background: white;
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(16, 24, 40, 0.08);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		text-align: left;
		padding: 10px 16px;
		border-bottom: 1px solid #eceef3;
		vertical-align: top;
	}
	th {
		font-size: 12px;
		color: #6b7286;
		font-weight: 500;
	}
	tbody tr {
		cursor: pointer;
	}
	tbody tr:hover {
		background: #f8f9fc;
	}
	.urgency {
		color: #b42318;
		font-weight: 700;
	}
	footer {
		justify-content: space-between;
	}
	.pager {
		display: flex;
		gap: 12px;
	}
</style>
