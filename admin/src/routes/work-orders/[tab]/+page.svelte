<script lang="ts">
	import { goto } from '$app/navigation';
	import { date } from '#lib/format.ts';
	import { PAGE_SIZE, STATE, TABS, URGENCY, quoteStatusPill } from '#lib/labels.ts';
	import Pill from '#lib/ui/Pill.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pages = $derived(Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)));
	/** The list's filters as URL parameters, kept across tabs and pages. */
	const query = (extra: Record<string, string> = {}) => {
		const params = new URLSearchParams({ ...(data.search && { search: data.search }), ...(data.withPriceList && { priced: '1' }), ...(data.chargeable && { chargeable: '1' }), ...extra });
		return params.size ? `?${params}` : '';
	};
</script>

<h1>Work orders</h1>

<form class="filters" method="GET">
	<input name="search" value={data.search} placeholder="Search by number, title or client" />
	<div class="toggles" role="group" aria-labelledby="filters-label">
		<span id="filters-label" class="toggles-label">Filters</span>
		<label class="toggle">
			<input type="checkbox" role="switch" name="priced" value="1" checked={data.withPriceList} onchange={(e) => e.currentTarget.form?.requestSubmit()} />
			<span class="track" aria-hidden="true"></span>
			Has a price list
		</label>
		<label class="toggle">
			<input type="checkbox" role="switch" name="chargeable" value="1" checked={data.chargeable} onchange={(e) => e.currentTarget.form?.requestSubmit()} />
			<span class="track" aria-hidden="true"></span>
			Chargeable
		</label>
	</div>
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
			{#if data.page > 1}<a href={query({ page: String(data.page - 1) })}>‹ Previous</a>{/if}
			<span>Page {data.page} / {pages}</span>
			{#if data.page < pages}<a href={query({ page: String(data.page + 1) })}>Next ›</a>{/if}
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
	/* The filters as switches in one white pill, next to the search. */
	.toggles {
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 7px 14px;
		border: 1px solid #e3e6ec;
		border-radius: 999px;
		background: white;
	}
	.toggles-label {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #6b7385;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
		cursor: pointer;
	}
	.toggle input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}
	.track {
		position: relative;
		width: 32px;
		height: 18px;
		border-radius: 999px;
		background: #cdd3df;
		transition: background 0.15s;
	}
	.track::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 2px rgba(16, 24, 40, 0.2);
		transition: transform 0.15s;
	}
	.toggle input:checked + .track {
		background: #3d63dd;
	}
	.toggle input:checked + .track::after {
		transform: translateX(14px);
	}
	.toggle input:focus-visible + .track {
		outline: 2px solid #3d63dd;
		outline-offset: 2px;
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
