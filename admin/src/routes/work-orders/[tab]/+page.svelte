<script lang="ts">
	import { goto } from '$app/navigation';
	import { date } from '#lib/format.ts';
	import { PAGE_SIZE, STATE, TABS, URGENCY } from '#lib/labels.ts';
	import Pill from '#lib/ui/Pill.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pages = $derived(Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)));
	const query = (page: number) => `?${new URLSearchParams({ ...(data.search && { search: data.search }), page: String(page) })}`;
</script>

<h1>Work orders</h1>

<form class="search" method="GET">
	<input name="search" value={data.search} placeholder="Search by number, title or client" />
</form>

<nav class="tabs">
	{#each Object.keys(TABS) as tab (tab)}
		<a href="/work-orders/{tab}{data.search ? `?search=${encodeURIComponent(data.search)}` : ''}" class:active={tab === data.tab}>{tab[0].toUpperCase() + tab.slice(1)}</a>
	{/each}
</nav>

<div class="card">
	<table>
		<thead>
			<tr><th>Date</th><th>Work order</th><th>Site - Unit</th><th>Client</th><th>Status</th><th>Urgency</th></tr>
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
					<td class="urgency">{URGENCY[wo.urgencyLevel]}</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="grey">No work orders</td></tr>
			{/each}
		</tbody>
	</table>
	<footer>
		<span class="grey">{data.totalCount} work orders</span>
		<span class="pager">
			{#if data.page > 1}<a href={query(data.page - 1)}>‹ Previous</a>{/if}
			<span>Page {data.page} / {pages}</span>
			{#if data.page < pages}<a href={query(data.page + 1)}>Next ›</a>{/if}
		</span>
	</footer>
</div>

<style>
	h1 {
		font-size: 22px;
		margin: 0 0 16px;
	}
	.search input {
		width: 320px;
		margin-bottom: 12px;
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
