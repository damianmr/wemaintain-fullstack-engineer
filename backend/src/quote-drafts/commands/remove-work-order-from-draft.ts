import type { Deps } from '../../shared/boilerplate/deps'
import { QuoteDraft } from '../domain/quote-draft'

export async function removeWorkOrderFromDraft(input: { draftId: string; workOrderId: string }, deps: Pick<Deps, 'quoteDrafts'>): Promise<QuoteDraft> {
  const draft = await deps.quoteDrafts.load(input.draftId)
  draft.removeWorkOrder(input.workOrderId)
  return deps.quoteDrafts.save(draft)
}
