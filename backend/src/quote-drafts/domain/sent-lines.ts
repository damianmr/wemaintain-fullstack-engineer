import { LineKind, SentDraftLine } from './quote-draft'

/** A line of the quote as Salesforce holds it when the customer receives it. */
export interface SentLine {
  lineId: string | null
  quantity: number
  unitPrice: number
  discount: number | null
}

/**
 * How many contract lines reached the customer at the list price. The roadmap counts a line when its final sent
 * price traces to an unchanged list price: same line, same quantity, same unit price, no discount. Compared with the
 * lines the draft last sent, so a line removed from the draft but not from Salesforce still counts as sent.
 */
export function observeSentLines(lines: SentDraftLine[], sent: SentLine[]) {
  const contractLines = lines.filter((line) => line.kind === LineKind.CONTRACT)
  const found = (line: SentDraftLine) => sent.find((s) => s.lineId === line.id)
  const unchanged = (line: SentDraftLine) => {
    const s = found(line)
    return !!s && s.quantity === line.quantity && s.unitPrice === line.unitPrice && !s.discount
  }
  return {
    contractLines: contractLines.length,
    atListPrice: contractLines.filter(unchanged).length,
    changedInSalesforce: contractLines.filter((line) => found(line) && !unchanged(line)).length,
    removedInSalesforce: contractLines.filter((line) => !found(line)).length,
    manualLines: lines.length - contractLines.length,
    addedInSalesforce: sent.filter((s) => !s.lineId || !lines.some((line) => line.id === s.lineId)).length,
  }
}

export type Observation = ReturnType<typeof observeSentLines>
