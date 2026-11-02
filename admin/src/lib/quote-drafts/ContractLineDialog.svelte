<script lang="ts">
	import { money } from '../format.ts';
	import { itemLabel } from '../labels.ts';
	import type { PriceListEntry, PriceListRule, QuoteDraft } from '../types.ts';
	import Dialog from '../ui/Dialog.svelte';
	import Pill from '../ui/Pill.svelte';
	import { mutate } from '../work-orders/mutate.ts';
	import { addContractLine, searchPriceList } from './fake.svelte.ts';

	let { open = $bindable(false), draft }: { open: boolean; draft: QuoteDraft } = $props();

	let search = $state('');
	let entries = $state<PriceListEntry[]>([]);
	let rules = $state<PriceListRule[]>([]);
	let picked = $state<PriceListEntry | null>(null);
	let rateId = $state<string | null>(null);
	let quantity = $state(1);
	/** The repair items this line covers, and how many of each. */
	let coverage = $state<{ itemId: string; quantity: number }[]>([]);

	$effect(() => {
		if (open) searchPriceList(draft.id, search).then((found) => ({ entries, rules } = found));
	});

	const rate = $derived(picked?.rates.find((r) => r.id === rateId) ?? null);
	const wholeQuantity = $derived(Number.isInteger(quantity) && quantity >= 1);
	const items = $derived(draft.workOrders.flatMap((wo) => wo.items.map((item) => ({ item, workOrderNumber: wo.workOrderNumber }))));

	function pick(entry: PriceListEntry) {
		picked = entry;
		rateId = entry.rates.length === 1 ? entry.rates[0].id : null;
		quantity = 1;
		coverage = [];
	}

	const covered = (itemId: string) => coverage.find((c) => c.itemId === itemId);

	function toggle(itemId: string, defaultQuantity: number) {
		coverage = covered(itemId) ? coverage.filter((c) => c.itemId !== itemId) : [...coverage, { itemId, quantity: defaultQuantity }];
	}

	function setCovered(itemId: string, quantity: number) {
		coverage = coverage.map((c) => (c.itemId === itemId ? { itemId, quantity } : c));
	}

	async function add() {
		const line = { rateId: rateId!, quantity, coverage };
		if (await mutate(() => addContractLine(draft.id, line), 'Contract line added')) {
			picked = null;
			open = false;
		}
	}
</script>

<Dialog bind:open title="Add from the contract list - {draft.priceListName}">
	{#if !picked}
		<input class="search" placeholder="Search by code or wording" bind:value={search} />
		<ul>
			{#each entries as entry (entry.id)}
				<li>
					<button class="link" disabled={!entry.pickable} onclick={() => pick(entry)}>{entry.code}</button>
					{entry.wording}
					<span class="grey">
						{#if !entry.pickable}unit to confirm{:else if entry.rates.length > 1}{entry.rates.length} time bands{:else}{money(entry.rates[0].amount, draft.currency)} {entry.unit}{/if}
					</span>
				</li>
			{:else}
				<li class="grey">No matching entry. Use a manual line for work the list does not price.</li>
			{/each}
		</ul>
		{#if rules.length}
			<h3>Rules, not prices</h3>
			<ul>
				{#each rules as rule (rule.id)}
					<li><Pill>{rule.code ?? 'Clause'}</Pill> {rule.description} <span class="grey">({rule.kind === 'INVOICE_MULTIPLIER' ? `× ${rule.value}` : `${rule.value}%`} on {rule.appliesTo})</span></li>
				{/each}
			</ul>
		{/if}
	{:else}
		<div class="picked">
			<div><strong>{picked.code}</strong> {picked.wording}</div>
			<div class="grey">{picked.section} · {picked.unit}{picked.notes ? ` · ${picked.notes}` : ''}</div>
		</div>

		{#if picked.rates.length > 1}
			<h3>Time band</h3>
			{#each picked.rates as option (option.id)}
				<label class="option">
					<input type="radio" name="band" value={option.id} bind:group={rateId} />
					<span><strong>{option.band?.label}</strong> <span class="grey">{option.band?.timeWindow}</span></span>
					<span class="price">{money(option.amount, draft.currency)}</span>
				</label>
			{/each}
		{/if}

		<h3>Quantity ({picked.unit})</h3>
		<input type="number" min="1" step="1" bind:value={quantity} />
		{#if !wholeQuantity}<div class="error">Quantities are whole numbers. Use a manual line for anything else.</div>{/if}

		<h3>Repair items this line covers</h3>
		{#each items as { item, workOrderNumber } (item.id)}
			<label class="option">
				<input type="checkbox" checked={!!covered(item.id)} onchange={() => toggle(item.id, item.quantity ?? 1)} />
				<span>{workOrderNumber} · {itemLabel(item)} <span class="grey">× {item.quantity ?? 1}</span></span>
				{#if covered(item.id)}
					<input class="small" type="number" min="1" step="1" value={covered(item.id)?.quantity} oninput={(e) => setCovered(item.id, e.currentTarget.valueAsNumber)} />
				{/if}
			</label>
		{:else}
			<p class="grey">No repair items on the draft's work orders.</p>
		{/each}

		{#if rate && wholeQuantity}<p class="total">{quantity} × {money(rate.amount, draft.currency)} = <strong>{money(rate.amount * quantity, draft.currency)}</strong></p>{/if}
	{/if}
	{#snippet actions()}
		{#if picked}
			<button onclick={() => (picked = null)}>Back</button>
			<button class="primary" disabled={!rate || !wholeQuantity} onclick={add}>Add line</button>
		{:else}
			<button onclick={() => (open = false)}>Close</button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.search {
		width: 100%;
		box-sizing: border-box;
	}
	ul {
		list-style: none;
		padding: 0;
		max-height: 280px;
		overflow: auto;
	}
	li {
		padding: 4px 0;
	}
	h3 {
		font-size: 13px;
		margin: 16px 0 6px;
	}
	.picked {
		padding: 10px 12px;
		background: #f4f5f8;
		border-radius: 6px;
	}
	.option {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 4px 0;
	}
	.option .price {
		margin-left: auto;
	}
	.small {
		width: 64px;
		margin-left: auto;
	}
	.error {
		color: #b42318;
		margin-top: 4px;
	}
	.total {
		text-align: right;
	}
</style>
