<script lang="ts">
	import { money } from '../format.ts';
	import { itemLabel, MANUAL_REASON } from '../labels.ts';
	import type { ContractPricing, PriceListRule, QuoteDraft, WorkOrder } from '../types.ts';
	import Pill from '../ui/Pill.svelte';
	import { mutate } from '../work-orders/mutate.ts';
	import AddWorkOrderDialog from './AddWorkOrderDialog.svelte';
	import ContractLineDialog from './ContractLineDialog.svelte';
	import ManualLineDialog from './ManualLineDialog.svelte';
	import { removeLine, removeWorkOrder, sendDraft, startDraft } from './api.ts';

	let { workOrder, pricing, draft }: { workOrder: WorkOrder; pricing: ContractPricing; draft: QuoteDraft | null } = $props();

	let addingWorkOrders = $state(false);
	let sending = $state(false);
	let addingContractLine = $state(false);
	let addingManualLine = $state(false);
	let manualRule = $state<PriceListRule | null>(null);

	function addManualLine(rule: PriceListRule | null = null) {
		manualRule = rule;
		addingManualLine = true;
	}

	const currency = $derived(draft?.currency ?? pricing.priceList.currency);

	async function send(draftId: string) {
		sending = true;
		let link: string | null = null;
		await mutate(async () => {
			link = await sendDraft(draftId);
		}, 'Quote sent to Salesforce');
		sending = false;
		if (link) window.open(link, '_blank', 'noopener,noreferrer');
	}

	// Two lines can cover the same item, even with the same code: a standby hour split over two time bands.
	const coveredBy = (itemId: string) => draft?.lines.filter((line) => line.coverage.some((c) => c.itemId === itemId)) ?? [];
</script>

<div class="card">
	<header>
		<h1>Quote draft</h1>
		<span class="grey">{pricing.priceList.name} · Contract {pricing.contractNo} · {currency}</span>
	</header>
	<div class="body">
		{#if !draft}
			<p>
				This contract has a price list. Build the quote here: contract lines take the agreed price from the list. Nothing goes to Salesforce
				until you send the draft.
			</p>
			{#if !workOrder.isChargeable}<p class="grey">This work order is not chargeable: no quote needed.</p>{/if}
		{:else}
			{#if draft.sfQuoteLink}
				<p>
					Salesforce quote <a href={draft.sfQuoteLink} target="_blank" rel="noopener noreferrer">↗ {draft.quoteNumber ?? draft.sfQuoteId}</a>
				</p>
				{#if draft.editable}
					<div class="alert">The quote is still Draft. Sending again replaces its lines with these; lines edited directly in Salesforce are lost.</div>
				{:else}
					<div class="alert">The quote has left Draft in Salesforce: this draft can no longer change.</div>
				{/if}
			{/if}
			<h2>Work orders</h2>
			{#each draft.workOrders as wo (wo.id)}
				<div class="work-order">
					<div>
						<a href="/work-orders/details/{wo.workOrderNumber}">{wo.workOrderNumber}</a>
						<span class="grey">{wo.deviceNo} · {wo.buildingName}</span>
						{#if wo.id === workOrder.id}<span class="grey">(this one)</span>{/if}
						{#if draft.editable && !draft.sfQuoteId && draft.workOrders.length > 1}
							<button class="link" aria-label="Remove {wo.workOrderNumber} from the draft" onclick={() => mutate(() => removeWorkOrder(draft.id, wo.id), 'Work order removed from the draft')}>✕</button>
						{/if}
					</div>
					<ul>
						{#each wo.items as item (item.id)}
							<li>
								{itemLabel(item)} <span class="grey">× {item.quantity ?? 1}</span>
								{#each coveredBy(item.id) as line (line.id)}<Pill theme="success">{line.code ?? 'manual'}</Pill>{/each}
								{#if item.type === 'EXTERNAL_PART' && !item.partId}<Pill theme="warning">Awaiting supply team</Pill>{/if}
							</li>
						{:else}
							<li class="grey">No repair items</li>
						{/each}
					</ul>
				</div>
			{/each}

			{#if draft.editable}<button class="link" onclick={() => (addingWorkOrders = true)}>+ Add work order</button>{/if}

			<h2>Lines</h2>
			{#each draft.lines as line (line.id)}
				<div class="line">
					<div class="main">
						<Pill theme={line.kind === 'CONTRACT' ? 'success' : 'neutral'}>{line.kind === 'CONTRACT' ? 'Contract' : 'Manual'}</Pill>
						<div>{line.customerText}</div>
						{#if line.reason}
							<div class="grey">{MANUAL_REASON[line.reason]}{line.ruleCode ? ` · rule ${line.ruleCode}` : ''}{line.note ? ` · ${line.note}` : ''}</div>
						{/if}
						{#if line.coverage.length}
							<div class="grey">Covers {line.coverage.map((c) => `${c.workOrderNumber} × ${c.quantity}`).join(', ')}</div>
						{/if}
					</div>
					<div class="amount">
						{line.quantity} × {money(line.unitPrice, currency)}
						<strong>{money(line.total, currency)}</strong>
					</div>
					{#if draft.editable}<button class="link" aria-label="Remove line" onclick={() => mutate(() => removeLine(draft.id, line.id), 'Line removed')}>✕</button>{/if}
				</div>
			{:else}
				<p class="grey">No lines yet</p>
			{/each}
			<div class="total">Total before tax: <strong>{money(draft.total, currency)}</strong></div>

			{#if draft.editable && draft.sendBlockers.length}
				<div class="alert warning">{#each draft.sendBlockers as blocker (blocker)}<div>{blocker}</div>{/each}</div>
			{/if}
		{/if}
	</div>
	<footer>
		{#if !draft}
			<button class="primary" disabled={!workOrder.isChargeable} onclick={() => mutate(() => startDraft(workOrder), 'Quote draft started')}>Start draft</button>
		{:else if draft.editable}
			<button onclick={() => (addingContractLine = true)}>+ Add from contract list</button>
			<button onclick={() => addManualLine()}>+ Add manual line</button>
			<button class="primary" disabled={draft.sendBlockers.length > 0 || sending} onclick={() => send(draft.id)}>
				{sending ? 'Sending…' : draft.sfQuoteId ? 'Send again to Salesforce' : 'Send to Salesforce'}
			</button>
		{/if}
	</footer>
</div>

{#if draft}
	<AddWorkOrderDialog bind:open={addingWorkOrders} {draft} />
	<ContractLineDialog bind:open={addingContractLine} {draft} onuserule={addManualLine} />
	<ManualLineDialog bind:open={addingManualLine} {draft} rule={manualRule} />
{/if}

<style>
	h2 {
		font-size: 14px;
		margin: 16px 0 8px;
	}
	h2:first-child {
		margin-top: 0;
	}
	.work-order {
		padding: 8px 0;
		border-bottom: 1px solid #eceef3;
	}
	.work-order ul {
		margin: 6px 0 0;
		padding-left: 18px;
	}
	.work-order li {
		padding: 2px 0;
	}
	.line {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 8px 0;
		border-bottom: 1px solid #eceef3;
	}
	.line .main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: flex-start;
	}
	.amount {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		white-space: nowrap;
	}
	.total {
		text-align: right;
		margin: 12px 0;
	}
	footer {
		align-items: center;
	}
</style>
