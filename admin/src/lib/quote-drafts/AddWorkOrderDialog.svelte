<script lang="ts">
	import { STATE } from '../labels.ts';
	import type { DraftCandidate, QuoteDraft } from '../types.ts';
	import Dialog from '../ui/Dialog.svelte';
	import Pill from '../ui/Pill.svelte';
	import { mutate } from '../work-orders/mutate.ts';
	import { addWorkOrders, findWorkOrdersToAdd } from './fake.svelte.ts';

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

<Dialog bind:open title="Add work orders - contract {draft.contractNo}">
	<p class="grey">Work orders on the same contract that are chargeable and have no quote or draft yet, in any building.</p>
	{#if candidates === null}
		<p class="grey">Loading…</p>
	{:else}
		{#each candidates as candidate (candidate.id)}
			<label class="option">
				<input type="checkbox" value={candidate.id} bind:group={selected} />
				<div>
					<div><strong>{candidate.workOrderNumber}</strong> {candidate.title}</div>
					<div class="grey">{candidate.deviceNo} · {candidate.buildingName} <Pill theme={STATE[candidate.state][1]}>{STATE[candidate.state][0]}</Pill></div>
				</div>
			</label>
		{:else}
			<p class="grey">No other work order to add.</p>
		{/each}
	{/if}
	{#snippet actions()}
		<button onclick={() => (open = false)}>Cancel</button>
		<button class="primary" disabled={!selected.length} onclick={add}>Add {selected.length || ''}</button>
	{/snippet}
</Dialog>

<style>
	.option {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 8px 0;
		border-bottom: 1px solid #eceef3;
	}
</style>
