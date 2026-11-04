import type { Deps } from '../../shared/boilerplate/deps'
import { PriceListRuleOrmEntity } from '../../price-lists/infrastructure/database/price-list-rule.orm-entity'
import { InvalidDraftLineError } from '../domain/errors'
import { ManualReason, QuoteDraft } from '../domain/quote-draft'
import { draftQuoteStatus } from '../infrastructure/draft-quote-status'

export async function addManualLine(
  input: { draftId: string; customerText: string; quantity: number; unitPrice: number; reason: ManualReason; note?: string; ruleId?: string },
  deps: Pick<Deps, 'db' | 'workOrders' | 'quoteDrafts'>,
): Promise<QuoteDraft> {
  const draft = await deps.quoteDrafts.load(input.draftId)
  draft.assertEditable(await draftQuoteStatus(draft, deps))
  const rule = input.ruleId ? await deps.db.getRepository(PriceListRuleOrmEntity).findOneBy({ id: input.ruleId }) : null
  if (input.ruleId && rule?.priceListId !== draft.priceListId) throw new InvalidDraftLineError('This rule is not in the price list of the draft')

  draft.addManualLine({ ...input, rule: rule ?? undefined })
  return deps.quoteDrafts.save(draft)
}
