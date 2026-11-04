<script lang="ts">
	import { STATE } from '../labels.ts';
	import type { DraftCandidate, QuoteDraft } from '../types.ts';
	import Dialog from '../ui/Dialog.svelte';
	import Pill from '../ui/Pill.svelte';
	import { mutate } from '../work-orders/mutate.ts';
	import { addWorkOrders, findWorkOrdersToAdd } from './api.ts';

	let { open = $bindable(false), draft }: { open: boolean; draft: QuoteDraft } = $props();
	let candidates = $state<DraftCandidate[] | null>(null);
	let selected = $state<string[]>([]);

	$effect(() => {
		if (!open) return;
		candidates = null;
		selected = [];
		findWorkOrdersToAdd(draft.id).then((found) => (candidates = found));
	});

	async function add() {
		if (await mutate(() => addWorkOrders(draft.id, selected), 'Work orders added to the draft')) open = false;
	}
</script>

<Dialog bind:open title="Add work orders">
	<!-- What the list holds, as tags rather than a sentence. -->
	<div class="rules">
		<span class="grey">Contract {draft.contractNo}</span>
		<span class="tag">Chargeable</span>
		<span class="tag">No quote yet</span>
		<span class="tag">Any building</span>
	</div>
	{#if candidates === null}
		<div class="box empty grey">Loading…</div>
	{:else if candidates.length}
		<div class="count grey">{candidates.length} work order{candidates.length > 1 ? 's' : ''}</div>
		<div class="box">
			{#each candidates as candidate (candidate.id)}
				<label class="option" class:checked={selected.includes(candidate.id)}>
					<input type="checkbox" value={candidate.id} bind:group={selected} />
					<div class="what">
						<div><strong>{candidate.workOrderNumber}</strong> {candidate.title ?? ''}</div>
						<div class="grey">{candidate.deviceNo} · {candidate.buildingName}</div>
					</div>
					<Pill theme={STATE[candidate.state][1]}>{STATE[candidate.state][0]}</Pill>
				</label>
			{/each}
		</div>
	{:else}
		<div class="box empty">
			<strong>No work orders to add</strong>
			<span class="grey">Every other chargeable work order on this contract already has a quote or a draft.</span>
		</div>
	{/if}
	{#snippet actions()}
		{#if candidates?.length}
			<button onclick={() => (open = false)}>Cancel</button>
			<button class="primary" disabled={!selected.length} onclick={add}>Add {selected.length || ''}</button>
		{:else}
			<button onclick={() => (open = false)}>Close</button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.rules {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-bottom: 14px;
	}
	.rules .grey {
		margin-right: 4px;
	}
	.tag {
		padding: 2px 8px;
		border-radius: 999px;
		background: #eef0f4;
		font-size: 12px;
	}
	.count {
		margin-bottom: 6px;
		font-size: 13px;
	}
	.box {
		border: 1px solid #e3e6ec;
		border-radius: 8px;
		max-height: 360px;
		overflow-y: auto;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 28px 16px;
		border-style: dashed;
		text-align: center;
	}
	.option {
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 10px 12px;
		border-bottom: 1px solid #eceef3;
		cursor: pointer;
	}
	.option:last-child {
		border-bottom: none;
	}
	.option:hover {
		background: #f6f7fa;
	}
	.option.checked {
		background: #eef4ff;
	}
	.what {
		flex: 1;
	}
</style>
