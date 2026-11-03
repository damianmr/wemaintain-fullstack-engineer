/** The work orders that are in a quote draft, written as SQL so a list can filter on it. */
export const DRAFTED_WORK_ORDERS = `SELECT "workOrderId" FROM workorders.quote_draft_work_order`
