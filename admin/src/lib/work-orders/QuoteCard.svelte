<script lang="ts">
	import { date, money } from '../format.ts';
	import { quoteStatusPill, URGENCY } from '../labels.ts';
	import type { ContractPricing, WorkOrder } from '../types.ts';
	import Pill from '../ui/Pill.svelte';
	import AttachQuoteDialog from './AttachQuoteDialog.svelte';
	import { pushQuoteToSalesforce } from './api.ts';
	import { mutate } from './mutate.ts';

	// With a contract price list, the quote is built in the quote draft card instead.
	let { workOrder, pricing = null }: { workOrder: WorkOrder; pricing?: ContractPricing | null } = $props();
	let generating = $state(false);
	let attaching = $state(false);

	const quote = $derived(workOrder.quote);
	const status = $derived(quoteStatusPill(quote?.status ?? workOrder.quoteStatus, workOrder.items));
	// The backend refuses the push while an external part has no catalogue part.
	const awaitingSupply = $derived(workOrder.items.filter((i) => i.type === 'EXTERNAL_PART' && !i.partId).length);

	async function generateQuote() {
		generating = true;
		let link: string | null = null;
		await mutate(async () => {
			[{ sfQuoteLink: link }] = await pushQuoteToSalesforce([workOrder.id]);
		}, 'Quote generated on Salesforce');
		generating = false;
		if (link) window.open(link, '_blank', 'noopener,noreferrer');
	}
</script>

<div class="card">
	<header><h1>Details</h1></header>
	<div class="body">
		<dl>
			<dt>Description</dt><dd>{workOrder.description}</dd>
			<dt>Chargeable</dt><dd>{workOrder.isChargeable ? 'Yes' : 'No'}</dd>
			<dt>Urgency</dt><dd>{URGENCY[workOrder.urgencyLevel]}</dd>
			<dt>Created</dt><dd>{date(workOrder.createdAt)}</dd>
		</dl>

		<h2>Quote information</h2>
		{#if workOrder.sfQuoteId && !workOrder.isChargeable}
			<div class="alert warning">Warning: the work order is non-chargeable but there is an associated quote.</div>
		{/if}
		<dl>
			<dt>SF link</dt>
			<dd class="row">
				{#if workOrder.sfQuoteId}
					<a href={workOrder.sfQuoteLink} target="_blank" rel="noopener noreferrer">↗ {quote?.number ?? workOrder.quoteNumber}</a>
				{:else if workOrder.isChargeable && pricing}
					<span class="grey">See the quote draft below</span>
				{:else if workOrder.isChargeable}
					<button class="primary" disabled={workOrder.state === 'PART_TO_ESTIMATE' || awaitingSupply > 0 || generating} onclick={generateQuote}>
						{generating ? 'Generating…' : 'Generate quote on Salesforce'}
					</button>
					<button class="link" disabled={awaitingSupply > 0} onclick={() => (attaching = true)}>🔗 Attach quote</button>
					{#if awaitingSupply}<span class="grey">{awaitingSupply} external part{awaitingSupply > 1 ? 's' : ''} awaiting the supply team</span>{/if}
				{:else}
					<span class="grey">No quote needed</span>
				{/if}
			</dd>
			<dt>Quote price</dt>
			<dd>{workOrder.isChargeable ? (quote ? money(quote.grandTotal, quote.currencyISOCode) : '--') : 'No quote needed'}</dd>
			<dt>Quote status</dt>
			<dd>{#if workOrder.isChargeable}<Pill theme={status[1]}>{status[0]}</Pill>{:else}<span class="grey">No quote needed</span>{/if}</dd>
			<dt>Linked work orders</dt>
			<dd>
				{#each workOrder.bundledWorkOrders as other (other.id)}
					<div><a href="/work-orders/details/{other.workOrderNumber}">{other.workOrderNumber} • {other.device?.deviceNo}</a></div>
				{:else}--{/each}
			</dd>
		</dl>
	</div>
</div>

<AttachQuoteDialog bind:open={attaching} {workOrder} />

<style>
	h2 {
		font-size: 14px;
		margin: 20px 0 10px;
	}
	dl {
		display: grid;
		grid-template-columns: 160px 1fr;
		gap: 8px;
		margin: 0;
		align-items: center;
	}
	dt {
		color: #6b7286;
	}
	dd {
		margin: 0;
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
	}
</style>
