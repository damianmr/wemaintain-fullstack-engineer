import type { Deps } from '../../shared/boilerplate/deps'
import { PriceListBandOrmEntity } from '../../price-lists/infrastructure/database/price-list-band.orm-entity'
import { PriceListEntryOrmEntity } from '../../price-lists/infrastructure/database/price-list-entry.orm-entity'
import { PriceListRateOrmEntity } from '../../price-lists/infrastructure/database/price-list-rate.orm-entity'
import { InvalidDraftLineError } from '../domain/errors'
import { QuoteDraft } from '../domain/quote-draft'
import { draftQuoteStatus } from '../infrastructure/draft-quote-status'
import { loadDraftWorkOrders } from '../infrastructure/draft-work-orders'

/** Adds a line priced by the server from the draft's contract list. The browser only says which rate. */
export async function addContractLine(
  input: { draftId: string; rateId: string; quantity: number; coverage: { itemId: string; quantity: number }[] },
  deps: Pick<Deps, 'db' | 'workOrders' | 'quoteDrafts'>,
): Promise<QuoteDraft> {
  const draft = await deps.quoteDrafts.load(input.draftId)
  draft.assertEditable(await draftQuoteStatus(draft, deps))

  const rate = await deps.db.getRepository(PriceListRateOrmEntity).findOneBy({ id: input.rateId })
  const entry = rate && (await deps.db.getRepository(PriceListEntryOrmEntity).findOneBy({ id: rate.entryId }))
  if (!rate || !entry || entry.priceListId !== draft.priceListId) throw new InvalidDraftLineError('This rate is not in the price list of the draft')
  const band = rate.bandId ? await deps.db.getRepository(PriceListBandOrmEntity).findOneByOrFail({ id: rate.bandId }) : null

  draft.addContractLine(
    { rate: { rateId: rate.id, amount: rate.amount, entry, band }, quantity: input.quantity, coverage: input.coverage },
    await loadDraftWorkOrders(draft.workOrderIds, draft.pricingDate, deps),
  )
  return deps.quoteDrafts.save(draft)
}
