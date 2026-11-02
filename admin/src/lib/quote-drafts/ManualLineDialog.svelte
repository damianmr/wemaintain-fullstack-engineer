<script lang="ts">
	import { money } from '../format.ts';
	import { MANUAL_REASON } from '../labels.ts';
	import type { ManualReason, PriceListRule, QuoteDraft } from '../types.ts';
	import Dialog from '../ui/Dialog.svelte';
	import { mutate } from '../work-orders/mutate.ts';
	import { addManualLine } from './api.ts';

	let { open = $bindable(false), draft, rule = null }: { open: boolean; draft: QuoteDraft; rule?: PriceListRule | null } = $props();

	const REASONS = (Object.keys(MANUAL_REASON) as ManualReason[]).filter((reason) => reason !== 'IMPORTED');

	let customerText = $state('');
	let quantity = $state(1);
	let unitPrice = $state<number | null>(null);
	let reason = $state<ManualReason | ''>('');
	let note = $state('');

	$effect(() => {
		if (open && rule) reason = reasonFor(rule);
	});

	// 0097AS multiplies a supplier's invoice; 5510AS and 5050AS a subcontractor's.
	function reasonFor(rule: PriceListRule): ManualReason {
		if (rule.kind !== 'INVOICE_MULTIPLIER') return 'OTHER';
		return /subcontractor/i.test(`${rule.description} ${rule.appliesTo}`) ? 'SUBCONTRACTED_WORK' : 'PART_NOT_ON_LIST';
	}

	const valid = $derived(customerText.trim() !== '' && Number.isInteger(quantity) && quantity >= 1 && unitPrice !== null && reason !== '');

	async function add() {
		const line = { customerText: customerText.trim(), quantity, unitPrice: unitPrice!, reason: reason as ManualReason, note: note.trim(), ruleId: rule?.id ?? null };
		if (await mutate(() => addManualLine(draft.id, line), 'Manual line added')) {
			customerText = '';
			unitPrice = null;
			reason = '';
			note = '';
			open = false;
		}
	}
</script>

<Dialog bind:open title="Add a manual line">
	<p class="grey">
		For work the contract list does not price. A contract line always keeps the list price, so any other price is a manual line, with the
		reason recorded.
	</p>
	<label>Customer text<input bind:value={customerText} placeholder="What the customer reads on the quote" /></label>
	<div class="row">
		<label>Quantity<input type="number" min="1" step="1" bind:value={quantity} /></label>
		<label>Unit price ({draft.currency})<input type="number" step="0.01" bind:value={unitPrice} /></label>
	</div>
	<label>
		Reason
		<select bind:value={reason}>
			<option value="" disabled>Choose a reason</option>
			{#each REASONS as option (option)}<option value={option}>{MANUAL_REASON[option]}</option>{/each}
		</select>
	</label>
	{#if rule}<p class="grey">Follows the contract rule {rule.code ?? 'clause'}: {rule.description}.</p>{/if}
	<label>Note<textarea rows="2" bind:value={note} placeholder="For example: supplier invoice EUR 500 × 1.41"></textarea></label>
	{#if unitPrice !== null && Number.isInteger(quantity)}<p class="total">Total: <strong>{money(unitPrice * quantity, draft.currency)}</strong></p>{/if}
	{#snippet actions()}
		<button onclick={() => (open = false)}>Cancel</button>
		<button class="primary" disabled={!valid} onclick={add}>Add line</button>
	{/snippet}
</Dialog>

<style>
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 12px;
	}
	.row {
		display: flex;
		gap: 12px;
	}
	.row label {
		flex: 1;
	}
	.total {
		text-align: right;
	}
</style>
