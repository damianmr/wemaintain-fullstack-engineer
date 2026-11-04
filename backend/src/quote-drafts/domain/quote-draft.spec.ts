import { RuleKind } from '../../price-lists/domain/price-list'
import { QuoteStatus } from '../../quotes/domain/quote'
import { DraftNotEditableError, InvalidDraftLineError, WorkOrderNotEligibleError } from './errors'
import { DraftStatus, DraftWorkOrder, LineKind, ManualReason, QuoteDraft } from './quote-draft'

const workOrder = (overrides: Partial<DraftWorkOrder> = {}): DraftWorkOrder => ({
  id: 'wo-1',
  workOrderNumber: 'R26-15433',
  contractId: 'contract-1',
  isChargeable: true,
  waitingForParts: false,
  items: [{ id: 'pack-1', quantity: 1 }],
  ...overrides,
})

const remoteAlarm = {
  rateId: 'rate-0435AS',
  amount: 1360,
  entry: { code: '0435AS', wording: 'Remote alarm replacement incl. three-way intercom and GSM gateway', unit: 'each' },
}

const newDraft = (first = workOrder()) => QuoteDraft.start({ contractId: 'contract-1', priceListId: 'lindenhome', currency: 'EUR', workOrder: first })

describe('QuoteDraft', () => {
  it('prices one contract line over the repair items of three work orders, like quote 00032036', () => {
    const torres = workOrder()
    const gimenez = workOrder({ id: 'wo-2', workOrderNumber: 'R26-15436', items: [{ id: 'pack-2', quantity: 1 }] })
    const georges = workOrder({ id: 'wo-3', workOrderNumber: 'R26-15437', items: [{ id: 'pack-3', quantity: 2 }] })
    const draft = newDraft(torres)
    draft.addWorkOrder(gimenez)
    draft.addWorkOrder(georges)

    const line = draft.addContractLine(
      { rate: remoteAlarm, quantity: 4, coverage: [{ itemId: 'pack-1', quantity: 1 }, { itemId: 'pack-2', quantity: 1 }, { itemId: 'pack-3', quantity: 2 }] },
      [torres, gimenez, georges],
    )

    expect(line).toMatchObject({ kind: LineKind.CONTRACT, customerText: '0435AS Remote alarm replacement incl. three-way intercom and GSM gateway, each', unitPrice: 1360, total: 5440 })
    expect(line.coverage.map((c) => c.workOrderId)).toEqual(['wo-1', 'wo-2', 'wo-3'])
    expect(draft.total).toBe(5440)
  })

  it('writes a Meridian line with its unit and band', () => {
    const draft = newDraft()
    const standby = { rateId: 'rate-65-after', amount: 167, entry: { code: '65', wording: 'Standby technician', unit: 'Per Man-hr' }, band: { label: 'After office hours' } }
    expect(draft.addContractLine({ rate: standby, quantity: 8, coverage: [] }, [workOrder()])).toMatchObject({
      customerText: '65 Standby technician, Per Man-hr, after office hours',
      bandLabel: 'After office hours',
      total: 1336,
    })
  })

  it('only lets in work orders on the same contract that are chargeable and not quoted yet', () => {
    const draft = newDraft()
    expect(() => draft.addWorkOrder(workOrder({ id: 'wo-2', contractId: 'contract-2' }))).toThrow(WorkOrderNotEligibleError)
    expect(() => draft.addWorkOrder(workOrder({ id: 'wo-2', isChargeable: false }))).toThrow('not chargeable')
    expect(() => draft.addWorkOrder(workOrder({ id: 'wo-2', sfQuoteId: '0Q0X' }))).toThrow('already has a Salesforce quote')
    expect(() => draft.addWorkOrder(workOrder())).toThrow('already in the draft')
  })

  it('takes whole quantities only, and an entry only when the list gives its unit', () => {
    const draft = newDraft()
    expect(() => draft.addContractLine({ rate: remoteAlarm, quantity: 1.5, coverage: [] }, [workOrder()])).toThrow(InvalidDraftLineError)
    const noUnit = { ...remoteAlarm, entry: { code: '6056AS', wording: 'Supply and installation of a lift', unit: null } }
    expect(() => draft.addContractLine({ rate: noUnit, quantity: 1, coverage: [] }, [workOrder()])).toThrow('no unit')
  })

  it('refuses coverage of an item outside the draft, or beyond its quantity', () => {
    const draft = newDraft()
    expect(() => draft.addContractLine({ rate: remoteAlarm, quantity: 1, coverage: [{ itemId: 'elsewhere', quantity: 1 }] }, [workOrder()])).toThrow('not on a work order')
    expect(() => draft.addContractLine({ rate: remoteAlarm, quantity: 1, coverage: [{ itemId: 'pack-1', quantity: 2 }] }, [workOrder()])).toThrow('only 1')
  })

  it('needs a reason for a manual line, and keeps the rule it followed', () => {
    const draft = newDraft()
    const rule = { id: 'rule-0097', code: '0097AS', kind: RuleKind.MULTIPLIER, value: 1.41, description: 'Coefficient on a part not on the price list' }
    const line = draft.addManualLine({ customerText: 'Car display (invoice EUR 310)', quantity: 1, unitPrice: 437.1, reason: ManualReason.PART_NOT_ON_LIST, rule })
    expect(line).toMatchObject({
      kind: LineKind.MANUAL,
      reason: ManualReason.PART_NOT_ON_LIST,
      ruleId: 'rule-0097',
      code: '0097AS',
      customerText: '0097AS Coefficient on a part not on the price list, x 1.41: Car display (invoice EUR 310)',
    })
    expect(() => draft.addManualLine({ customerText: 'x', quantity: 1, unitPrice: 1, reason: ManualReason.IMPORTED })).toThrow('adopted quote')
  })

  it('lets a manual line take a deduction off, at a negative price', () => {
    const draft = newDraft()
    draft.addManualLine({ customerText: '0095AS deduction, 2 levels below the base 6', quantity: 2, unitPrice: -171.81, reason: ManualReason.OTHER })
    expect(draft.total).toBe(-343.62)
  })

  it('cannot be sent without lines, or while supply still has to identify a part', () => {
    const waiting = workOrder({ waitingForParts: true })
    const draft = newDraft(waiting)
    expect(draft.sendBlockers([waiting])).toEqual(['Add at least one line.', 'R26-15433 is waiting for the supply team to identify its parts.'])
  })

  it('stays editable after sending while the Salesforce quote is Draft, and closes once it moves on', () => {
    const draft = newDraft()
    draft.addManualLine({ customerText: 'Labour', quantity: 1, unitPrice: 103.72, reason: ManualReason.OTHER })
    draft.markSent('0Q0X')
    expect(draft.status).toBe(DraftStatus.SENT)
    // What was sent stays known even if the draft changes before the quote is updated.
    draft.removeLine(draft.lines[0].id)
    expect(draft.sentLines).toEqual([expect.objectContaining({ kind: LineKind.MANUAL, unitPrice: 103.72 })])
    expect(draft.isEditable(QuoteStatus.DRAFT)).toBe(true)
    expect(() => draft.assertEditable(QuoteStatus.TO_SIGN)).toThrow(DraftNotEditableError)
  })

  it('knows when Salesforce is behind the draft after a send', () => {
    const draft = newDraft()
    draft.addManualLine({ customerText: 'Labour', quantity: 1, unitPrice: 103.72, reason: ManualReason.OTHER })
    expect(draft.hasUnsentChanges([workOrder()])).toBe(false)
    draft.markSent('0Q0X')
    const onQuote = workOrder({ sfQuoteId: '0Q0X' })
    expect(draft.hasUnsentChanges([onQuote])).toBe(false)

    draft.addContractLine({ rate: remoteAlarm, quantity: 1, coverage: [] }, [onQuote])
    expect(draft.hasUnsentChanges([onQuote])).toBe(true)
    draft.markSent('0Q0X')
    expect(draft.hasUnsentChanges([onQuote])).toBe(false)

    // A work order that joined after the send is not on the quote until the next one.
    const joined = workOrder({ id: 'wo-2', workOrderNumber: 'R26-15436' })
    draft.addWorkOrder(joined)
    expect(draft.hasUnsentChanges([onQuote, joined])).toBe(true)
  })

  it('lets a work order leave before the first send, taking its coverage with it', () => {
    const second = workOrder({ id: 'wo-2', workOrderNumber: 'R26-15436', items: [{ id: 'pack-2', quantity: 1 }] })
    const draft = newDraft()
    draft.addWorkOrder(second)
    draft.addContractLine({ rate: remoteAlarm, quantity: 2, coverage: [{ itemId: 'pack-1', quantity: 1 }, { itemId: 'pack-2', quantity: 1 }] }, [workOrder(), second])

    draft.removeWorkOrder('wo-2')
    expect(draft.lines[0].coverage.map((c) => c.itemId)).toEqual(['pack-1'])

    draft.markSent('0Q0X')
    expect(() => draft.removeWorkOrder('wo-1')).toThrow(DraftNotEditableError)
  })

  it('adopts an old-way Draft quote, bringing its lines in as manual lines to review', () => {
    const draft = QuoteDraft.adopt({
      contractId: 'contract-1',
      priceListId: 'lindenhome',
      currency: 'EUR',
      sfQuoteId: '0Q0X',
      workOrders: [workOrder({ sfQuoteId: '0Q0X' }), workOrder({ id: 'wo-2', workOrderNumber: 'R26-15307', sfQuoteId: '0Q0X' })],
      lines: [
        { customerText: 'Replacement of electrocam', quantity: 1, unitPrice: 2200 },
        { customerText: 'Labour', quantity: 2, unitPrice: 90, note: 'Imported from the existing Salesforce quote: 100 with a 10% discount' },
      ],
    })
    expect(draft).toMatchObject({ status: DraftStatus.SENT, sfQuoteId: '0Q0X', workOrderIds: ['wo-1', 'wo-2'] })
    expect(draft.lines[0]).toMatchObject({ kind: LineKind.MANUAL, reason: ManualReason.IMPORTED, total: 2200, note: 'Imported from the existing Salesforce quote' })
    expect(draft.lines[1]).toMatchObject({ total: 180, note: 'Imported from the existing Salesforce quote: 100 with a 10% discount' })
  })
})
