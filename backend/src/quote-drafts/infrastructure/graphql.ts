import type { Deps } from '../../shared/boilerplate/deps'
import { addContractLine } from '../commands/add-contract-line'
import { addManualLine } from '../commands/add-manual-line'
import { addWorkOrdersToDraft } from '../commands/add-work-orders-to-draft'
import { removeDraftLine } from '../commands/remove-draft-line'
import { removeWorkOrderFromDraft } from '../commands/remove-work-order-from-draft'
import { sendQuoteDraft } from '../commands/send-quote-draft'
import { startQuoteDraft } from '../commands/start-quote-draft'
import { QuoteDraft } from '../domain/quote-draft'
import { findDraftCandidates } from '../queries/find-draft-candidates'
import { getQuoteDraftForWorkOrder } from '../queries/get-quote-draft'

type Args = Record<string, any>

export function quoteDraftResolvers(deps: Deps) {
  const reread = (draft: QuoteDraft) => getQuoteDraftForWorkOrder({ workOrderId: draft.workOrderIds[0] }, deps)
  return {
    Query: {
      draftCandidates: (_: unknown, args: Args) => findDraftCandidates({ draftId: args.draftId }, deps),
    },
    Mutation: {
      startQuoteDraft: async (_: unknown, args: Args) => reread(await startQuoteDraft({ workOrderId: args.workOrderId }, deps)),
      addWorkOrdersToDraft: async (_: unknown, args: Args) => reread(await addWorkOrdersToDraft({ draftId: args.draftId, workOrderIds: args.workOrderIds }, deps)),
      removeWorkOrderFromDraft: async (_: unknown, args: Args) =>
        reread(await removeWorkOrderFromDraft({ draftId: args.draftId, workOrderId: args.workOrderId }, deps)),
      addContractLine: async (_: unknown, { input }: Args) => reread(await addContractLine(input, deps)),
      addManualLine: async (_: unknown, { input }: Args) =>
        reread(await addManualLine({ ...input, note: input.note ?? undefined, ruleId: input.ruleId ?? undefined }, deps)),
      removeDraftLine: async (_: unknown, args: Args) => reread(await removeDraftLine({ draftId: args.draftId, lineId: args.lineId }, deps)),
      sendQuoteDraft: async (_: unknown, args: Args) => reread(await sendQuoteDraft({ draftId: args.draftId }, deps)),
    },
    WorkOrderDetails: {
      quoteDraft: (workOrder: { id: string }) => getQuoteDraftForWorkOrder({ workOrderId: workOrder.id }, deps),
    },
    QuoteDraft: {
      sfQuoteLink: (draft: { sfQuoteId: string | null }) => (draft.sfQuoteId ? deps.salesforce.recordUrl('Quote', draft.sfQuoteId) : null),
    },
  }
}
