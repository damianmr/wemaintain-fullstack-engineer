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
		if (rule.kind !== 'MULTIPLIER') return 'OTHER';
		return /subcontractor/i.test(`${rule.description} ${rule.appliesTo}`) ? 'SUBCONTRACTED_WORK' : 'PART_NOT_ON_LIST';
	}

	// What the customer will read: a line that follows a rule starts with the rule as the contract prints it.
	const previewText = $derived(rule ? `${rule.lineText}: ${customerText.trim() || '…'}` : customerText.trim() || '…');

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
	{#if rule}
		<label>
			Customer text
			<span class="fixed">{rule.lineText}:</span>
			<input bind:value={customerText} placeholder="What this line is for, for example: Door motor (supplier invoice EUR 500)" />
		</label>
	{:else}
		<label>Customer text<input bind:value={customerText} placeholder="What the customer reads on the quote" /></label>
	{/if}
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
	<div class="preview">
		<span class="grey">On the customer's quote</span>
		<table>
			<thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
			<tbody>
				<tr>
					<td>{previewText}</td>
					<td>{quantity}</td>
					<td>{unitPrice === null ? '…' : money(unitPrice, draft.currency)}</td>
					<td>{unitPrice === null || !Number.isInteger(quantity) ? '…' : money(unitPrice * quantity, draft.currency)}</td>
				</tr>
			</tbody>
		</table>
	</div>
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
	.fixed {
		font-weight: 600;
	}
	.preview {
		margin-top: 4px;
		padding: 10px 12px;
		border: 1px solid #d8dde4;
		border-radius: 6px;
		background: #f7f8fa;
	}
	.preview table {
		width: 100%;
		margin-top: 6px;
		border-collapse: collapse;
		font-size: 13px;
	}
	.preview th {
		text-align: left;
		font-weight: 600;
		border-bottom: 1px solid #d8dde4;
	}
	.preview th:not(:first-child),
	.preview td:not(:first-child) {
		text-align: right;
		white-space: nowrap;
		padding-left: 12px;
	}
</style>
