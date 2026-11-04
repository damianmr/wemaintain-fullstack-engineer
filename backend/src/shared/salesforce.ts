export interface QuoteProduct {
  sku: string
  quantity: number
  cost?: number | null
  price?: number
  /** What the customer reads instead of the product's name. */
  productName?: string
  /** Our id for the line, stored on the Salesforce line (WeMaintain_Line_ID__c) to match it back. */
  lineId?: string
}

export interface SendQuotePayload {
  deviceIds: string[]
  products: QuoteProduct[]
  rrIds?: string[]
  quoteDescription?: string
  quoteId?: string
  ownerEmail?: string | null
}

export interface SendQuoteResponse {
  quoteId: string
  quoteStatus: string
}

export class SalesforceClient {
  constructor(private readonly baseUrl: string) {}

  /** Where a person opens this record in Salesforce. */
  recordUrl(sobject: string, id: string): string {
    return `${this.baseUrl}/lightning/r/${sobject}/${id}/view`
  }

  async query<T>(soql: string): Promise<T[]> {
    const result = await this.request<{ records: T[] }>('GET', `/services/data/v59.0/query?q=${encodeURIComponent(soql)}`)
    return result.records
  }

  async update(sobject: string, id: string, fields: Record<string, unknown>): Promise<void> {
    await this.request('PATCH', `/services/data/v59.0/sobjects/${sobject}/${id}`, fields)
  }

  async sendQuote(payload: SendQuotePayload): Promise<SendQuoteResponse> {
    return this.request('POST', '/services/apexrest/createQuote', { r: payload })
  }

  async getWeMaintainId(sobject: string, field: string, id: string): Promise<string | undefined> {
    const [record] = await this.query<Record<string, string>>(`SELECT Id, ${field} FROM ${sobject} WHERE Id = '${id}'`)
    return record?.[field] ?? undefined
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`Salesforce ${method} ${path}: ${response.status} ${text}`)
    return (text ? JSON.parse(text) : undefined) as T
  }
}
