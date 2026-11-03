<script lang="ts">
	import { date, money } from '../format.ts';
	import { itemLabel, MANUAL_REASON, quoteStatusPill } from '../labels.ts';
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

	// The Salesforce quote, read live with the work order: the one place the page shows it on a contract with a price list.
	const sfLink = $derived(draft?.sfQuoteLink ?? workOrder.sfQuoteLink);
	const sfNumber = $derived(draft?.quoteNumber ?? workOrder.quote?.number ?? workOrder.quoteNumber);
	const sfStatus = $derived(quoteStatusPill(workOrder.quote?.status ?? workOrder.quoteStatus, workOrder.items));

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
		<h1>Quote</h1>
		<span class="grey">{pricing.priceList.name}</span>
	</header>
	<div class="body">
		{#if sfLink}
			<div class="summary">
				<span class="grey">Salesforce</span>
				<a href={sfLink} target="_blank" rel="noopener noreferrer">↗ {sfNumber}</a>
				<Pill theme={sfStatus[1]}>{sfStatus[0]}</Pill>
				{#if workOrder.quote}<strong class="price">{money(workOrder.quote.grandTotal, workOrder.quote.currencyISOCode)}</strong>{/if}
			</div>
		{/if}
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
					<div class="hint">You can adopt it and add lines now. Sending waits until this is done.</div>
				</div>
			{/if}
		{:else if !draft && workOrder.sfQuoteId}
			<p class="grey">The Salesforce quote is past Draft, so it can't be priced here. Move it back to Draft in Salesforce to change it.</p>
			{#if workOrder.bundledWorkOrders.length}
				<p class="grey">
					Also on this quote:
					{#each workOrder.bundledWorkOrders as other, i (other.id)}{i ? ', ' : ''}<a href="/work-orders/details/{other.workOrderNumber}">{other.workOrderNumber}</a>{/each}
				</p>
			{/if}
		{:else if !draft}
			<div class="empty">
				<div class="empty-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
						<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
						<path d="M14 3v5h5M9 13h6M9 17h4" />
					</svg>
				</div>
				<strong>No quote yet</strong>
				<span class="grey">Price this work order from the {pricing.priceList.name} list.</span>
				<button class="primary" onclick={() => mutate(() => startDraft(workOrder), 'Quote draft started')}>Start draft</button>
			</div>
		{:else}
			{#if draft.sfQuoteId && !draft.editable}
				<div class="alert">The quote is past Draft in Salesforce, so this draft is closed.</div>
			{:else if draft.sfQuoteId && draft.unsentChanges}
				<div class="alert warning">
					<span class="icon" aria-hidden="true">⚠︎</span><strong>Changes not sent.</strong> Updating the quote replaces its lines with these.
				</div>
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
				<div class="work-order" class:current={wo.id === workOrder.id}>
					<div>
						<a href="/work-orders/details/{wo.workOrderNumber}">{wo.workOrderNumber}</a>
						<span class="grey">{wo.deviceNo} · {wo.buildingName}</span>
						{#if wo.id === workOrder.id}<span class="this-one">This work order</span>{/if}
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

			{#if draft.editable}<button class="link add-work-order" onclick={() => (addingWorkOrders = true)}>+ Add work order</button>{/if}

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
					{#if parts.length}<div class="hint">You can keep working on the lines meanwhile.</div>{/if}
				</div>
			{/if}
		{/if}
	</div>
	{#if (canStart && adoptable) || draft?.editable}
		<footer>
			{#if !draft && adoptable}
				<button class="primary" onclick={() => mutate(() => adoptQuote(workOrder), 'Quote adopted into a draft')}>Adopt this quote</button>
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
	/* Room between the parts of the card, so each one reads on its own. */
	.summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		padding-bottom: 16px;
		margin-bottom: 20px;
		border-bottom: 1px solid #eceef3;
	}
	.summary .price {
		margin-left: auto;
	}
	/* No quote yet: centred, with the one action in the middle. */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 24px 16px 20px;
		text-align: center;
	}
	.empty-icon {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		margin-bottom: 6px;
		border-radius: 50%;
		background: #eef4ff;
		color: #3d63dd;
	}
	.empty strong {
		font-size: 15px;
	}
	.empty button {
		margin-top: 12px;
	}
	p {
		margin: 0 0 10px;
		line-height: 1.5;
	}
	.alert {
		margin: 20px 0;
		padding: 12px 14px;
		line-height: 1.5;
	}
	.alert > div + div {
		margin-top: 6px;
	}
	.alert .steps {
		margin: 8px 0 0;
	}
	.alert .hint {
		margin-top: 10px;
	}
	h2 {
		font-size: 14px;
		margin: 28px 0 10px;
	}
	h2:first-child {
		margin-top: 0;
	}
	.icon {
		margin-right: 6px;
		color: #9a6700;
	}
	.steps {
		margin: 8px 0 16px;
		padding-left: 22px;
	}
	.steps li {
		padding: 3px 0;
	}
	.work-order {
		padding: 12px 12px;
		border-bottom: 1px solid #eceef3;
		border-left: 3px solid transparent;
	}
	/* The work order on screen: tinted, with a coloured edge, so it stands out from the others in the draft. */
	.work-order.current {
		background: #f3f6fd;
		border-left-color: #3d63dd;
		border-radius: 4px;
	}
	.this-one {
		margin-left: 8px;
		padding: 2px 9px;
		border-radius: 999px;
		background: #3d63dd;
		color: #fff;
		font-size: 12px;
		font-weight: 500;
	}
	.work-order ul {
		margin: 8px 0 0;
		padding-left: 20px;
	}
	.work-order li {
		padding: 3px 0;
	}
	.work-order li :global(.pill) {
		margin-left: 6px;
	}
	.add-work-order {
		display: inline-block;
		margin-top: 14px;
	}
	.line {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		padding: 14px 0;
		border-bottom: 1px solid #eceef3;
	}
	.line .main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: flex-start;
	}
	.amount {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		white-space: nowrap;
	}
	.total {
		text-align: right;
		margin: 16px 0 4px;
	}
	footer {
		align-items: center;
	}
</style>
