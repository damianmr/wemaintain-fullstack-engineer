<script lang="ts">
	import { date, money } from '../format.ts';
	import { itemLabel, MANUAL_REASON } from '../labels.ts';
	import type { ContractPricing, Item, PriceListRule, QuoteDraft, WorkOrder, WorkOrderState } from '../types.ts';
	import Pill from '../ui/Pill.svelte';
	import { mutate } from '../work-orders/mutate.ts';
	import AddWorkOrderDialog from './AddWorkOrderDialog.svelte';
	import ContractLineDialog from './ContractLineDialog.svelte';
	import ManualLineDialog from './ManualLineDialog.svelte';
	import { adoptQuote, removeLine, removeWorkOrder, sendDraft, startDraft } from './api.ts';

	let { workOrder, pricing, draft }: { workOrder: WorkOrder; pricing: ContractPricing; draft: QuoteDraft | null } = $props();

	let addingWorkOrders = $state(false);
	let removing = $state(false);
	let sending = $state(false);
	let addingContractLine = $state(false);
	let addingManualLine = $state(false);
	let manualRule = $state<PriceListRule | null>(null);

	function addManualLine(rule: PriceListRule | null = null) {
		manualRule = rule;
		addingManualLine = true;
	}

	const currency = $derived(draft?.currency ?? pricing.priceList.currency);
	// A quote made the old way: still Draft, it can be adopted; past Draft, it stays as it is.
	const adoptable = $derived(!!workOrder.sfQuoteId && workOrder.quoteStatus === 'DRAFT');
	// A work order the contract covers needs no quote, so the card offers nothing.
	const canStart = $derived(!draft && workOrder.isChargeable && (adoptable || !workOrder.sfQuoteId));

	// One removal at a time: the rows move up when one goes, so a second click would hit the next work order.
	async function remove(draftId: string, workOrderId: string) {
		removing = true;
		await mutate(() => removeWorkOrder(draftId, workOrderId), 'Work order removed from the draft');
		removing = false;
	}

	async function send(draftId: string) {
		sending = true;
		let link: string | null = null;
		await mutate(async () => {
			link = await sendDraft(draftId);
		}, 'Quote sent to Salesforce');
		sending = false;
		if (link) window.open(link, '_blank', 'noopener,noreferrer');
	}

	// What supply still has to do on a work order, by the rule the backend uses to refuse a send.
	type Supply = { id: string; workOrderNumber: string; state: WorkOrderState; items: Pick<Item, 'type' | 'partId'>[] };
	const waitingFor = (wo: Supply) =>
		wo.items.some((item) => item.type === 'EXTERNAL_PART' && !item.partId)
			? 'the supply team still has to identify a part (Assign catalogue part, on the work order)'
			: wo.state === 'PART_TO_ESTIMATE'
				? 'some items have no cost yet'
				: null;
	const waiting = (workOrders: Supply[]) => workOrders.flatMap((wo) => (waitingFor(wo) ? [{ wo, reason: waitingFor(wo) }] : []));
	// Adopting brings in every work order of the quote: say before adopting which ones will hold back the send.
	const adoptWaiting = $derived(adoptable ? waiting([workOrder, ...workOrder.bundledWorkOrders]) : []);

	// Two lines can cover the same item, even with the same code: a standby hour split over two time bands.
	const coveredBy = (itemId: string) => draft?.lines.filter((line) => line.coverage.some((c) => c.itemId === itemId)) ?? [];
</script>

<div class="card">
	<header>
		<h1>Quote draft</h1>
		<span class="grey">{pricing.priceList.name} · Contract {pricing.contractNo} · {currency}</span>
	</header>
	<div class="body">
		{#if !draft && !workOrder.isChargeable}
			<p class="grey">This work order is not chargeable.</p>
		{:else if !draft && adoptable}
			<p>This work order already has a Salesforce quote in Draft. Adopt it to:</p>
			<ul class="steps">
				<li>bring in the quote's other work orders</li>
				<li>keep its current lines, to review</li>
				<li>add lines from the contract list</li>
			</ul>
			{#if adoptWaiting.length}
				<div class="alert warning">
					{#each adoptWaiting as { wo, reason } (wo.id)}<div><span class="icon" aria-hidden="true">⚠︎</span><a href="/work-orders/details/{wo.workOrderNumber}">{wo.workOrderNumber}</a>: {reason}.</div>{/each}
					<div>You can adopt it and add lines now. Sending waits until this is done.</div>
				</div>
			{/if}
		{:else if !draft && workOrder.sfQuoteId}
			<p class="grey">The Salesforce quote is past Draft, so it can't be priced here. Move it back to Draft in Salesforce to change it.</p>
		{:else if !draft}
			<p class="grey">No quote yet.</p>
		{:else}
			{#if draft.sfQuoteLink}
				<p>
					Salesforce quote <a href={draft.sfQuoteLink} target="_blank" rel="noopener noreferrer">↗ {draft.quoteNumber ?? draft.sfQuoteId}</a>
				</p>
				{#if draft.editable}
					<div class="alert warning"><span class="icon" aria-hidden="true">⚠︎</span>Updating the quote replaces its lines with these.</div>
				{:else}
					<div class="alert">The quote is past Draft in Salesforce, so this draft is closed.</div>
				{/if}
			{/if}
			{#each draft.observations.slice(0, 1) as seen (seen.observedAt)}
				<div class="alert">
					Presented to the customer on {date(seen.observedAt)}: {seen.atListPrice} of {seen.contractLines} contract lines at the list price{seen.changedInSalesforce
						? `, ${seen.changedInSalesforce} changed in Salesforce`
						: ''}{seen.removedInSalesforce ? `, ${seen.removedInSalesforce} removed` : ''}{seen.addedInSalesforce
						? `, ${seen.addedInSalesforce} added in Salesforce`
						: ''}.
				</div>
			{/each}
			<h2>Work orders</h2>
			{#each draft.workOrders as wo (wo.id)}
				<div class="work-order">
					<div>
						<a href="/work-orders/details/{wo.workOrderNumber}">{wo.workOrderNumber}</a>
						<span class="grey">{wo.deviceNo} · {wo.buildingName}</span>
						{#if wo.id === workOrder.id}<span class="grey">(this one)</span>{/if}
						<!-- Not the one on screen: removing it would take this page out of the draft, and the whole draft would seem gone. -->
						{#if draft.editable && !draft.sfQuoteId && wo.id !== workOrder.id}
							<button class="link" aria-label="Remove {wo.workOrderNumber} from the draft" disabled={removing} onclick={() => remove(draft.id, wo.id)}>✕</button>
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
				{@const parts = waiting(draft.workOrders)}
				<div class="alert warning">
					<strong><span class="icon" aria-hidden="true">⚠︎</span>Can't send yet</strong>
					<ul class="steps">
						{#if !draft.lines.length}<li>Add at least one line.</li>{/if}
						{#each parts as { wo, reason } (wo.id)}
							<li><a href="/work-orders/details/{wo.workOrderNumber}">{wo.workOrderNumber}</a>: {reason}.</li>
						{/each}
						{#if draft.lines.length && !parts.length}{#each draft.sendBlockers as blocker (blocker)}<li>{blocker}</li>{/each}{/if}
					</ul>
					{#if parts.length}<div>You can keep working on the lines meanwhile.</div>{/if}
				</div>
			{/if}
		{/if}
	</div>
	{#if canStart || draft?.editable}
		<footer>
			{#if !draft && adoptable}
				<button class="primary" onclick={() => mutate(() => adoptQuote(workOrder), 'Quote adopted into a draft')}>Adopt this quote</button>
			{:else if !draft}
				<button class="primary" onclick={() => mutate(() => startDraft(workOrder), 'Quote draft started')}>Start draft</button>
			{:else if draft?.editable}
				<button onclick={() => (addingContractLine = true)}>+ Add from contract list</button>
				<button onclick={() => addManualLine()}>+ Add manual line</button>
				<button class="primary" disabled={draft.sendBlockers.length > 0 || sending} onclick={() => draft && send(draft.id)}>
					{sending ? 'Sending…' : draft.sfQuoteId ? 'Update the Salesforce quote' : 'Send to Salesforce'}
				</button>
			{/if}
		</footer>
	{/if}
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
	.icon {
		margin-right: 6px;
		color: #9a6700;
	}
	.steps {
		margin: 6px 0 0;
		padding-left: 20px;
	}
	.steps li {
		padding: 2px 0;
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
