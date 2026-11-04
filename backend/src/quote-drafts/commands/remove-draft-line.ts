import type { Deps } from '../../shared/boilerplate/deps'
import { QuoteDraft } from '../domain/quote-draft'
import { draftQuoteStatus } from '../infrastructure/draft-quote-status'

export async function removeDraftLine(input: { draftId: string; lineId: string }, deps: Pick<Deps, 'workOrders' | 'quoteDrafts'>): Promise<QuoteDraft> {
  const draft = await deps.quoteDrafts.load(input.draftId)
  draft.assertEditable(await draftQuoteStatus(draft, deps))
  draft.removeLine(input.lineId)
  return deps.quoteDrafts.save(draft)
}
