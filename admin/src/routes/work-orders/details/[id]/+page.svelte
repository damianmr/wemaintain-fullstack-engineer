<script lang="ts">
	import QuoteDraftCard from '#lib/quote-drafts/QuoteDraftCard.svelte';
	import HeaderCard from '#lib/work-orders/HeaderCard.svelte';
	import ItemsCard from '#lib/work-orders/ItemsCard.svelte';
	import QuoteCard from '#lib/work-orders/QuoteCard.svelte';
	import SupportItemsCard from '#lib/work-orders/SupportItemsCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pricing = $derived(data.workOrder.contractPricing);
	const draft = $derived(data.workOrder.quoteDraft);
</script>

<a href="/work-orders/ongoing">‹ Work orders</a>
<HeaderCard workOrder={data.workOrder} />
<div class="column">
	<QuoteCard workOrder={data.workOrder} {pricing} />
	{#if pricing}<QuoteDraftCard workOrder={data.workOrder} {pricing} {draft} />{/if}
	<ItemsCard workOrder={data.workOrder} />
	<SupportItemsCard workOrder={data.workOrder} />
</div>

<style>
	a {
		display: inline-block;
		margin-bottom: 12px;
	}
	.column {
		max-width: 680px;
	}
</style>
