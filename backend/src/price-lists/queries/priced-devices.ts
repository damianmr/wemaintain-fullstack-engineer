/**
 * Devices whose active contract has a price list linked today: the work orders that show the quote draft card. The
 * same rule as findContractPricing, written as SQL so a list can filter on it.
 */
export const PRICED_DEVICES = `SELECT cd."deviceId" FROM contracts.contract_device cd
  JOIN pricing.contract_price_list l ON l."contractId" = cd."contractId"
  WHERE NOT cd."isTerminated" AND cd."deletedAt" IS NULL
    AND now() BETWEEN cd."startDate" AND cd."endDate"
    AND now() BETWEEN l."validFrom" AND l."validTo"`
