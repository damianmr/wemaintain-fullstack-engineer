-- What happens to quotes that already exist when C1 goes live?
-- Finding: most are past Draft and stay as they are. A few are old-way Draft
-- quotes, some with no lines yet: C1 adopts them into a quote draft. Quote
-- 00032043 (two work orders, no lines) is the demo example.
-- On the six pilot contracts, 2 November 2026: 247 work orders have a quote past
-- Draft, 6 sit on 5 old-way Draft quotes, 16 are ready to quote, 4 wait for parts.

with pilot as (
  select unnest(array['00019814', '00016840', '00018461', '00016613', '00014296', '00016179']) as contract_no
),
pilot_work_order as (
  select k."contractNo", w.*
  from workorders.work_order w
  join contracts.contract_device cd on cd."deviceId" = w."deviceId" and not cd."isTerminated" and cd."deletedAt" is null
  join contracts.contract k on k.id = cd."contractId"
  where k."contractNo" in (select contract_no from pilot)
)
select
  count(*) filter (where "sfQuoteId" is not null and "quoteStatus" <> 'draft') as quote_past_draft,
  count(*) filter (where "quoteStatus" = 'draft') as old_way_draft_quote,
  count(*) filter (where "sfQuoteId" is null and chargeable and state = 'QUOTE_TO_SEND') as ready_to_quote,
  count(*) filter (where "sfQuoteId" is null and chargeable and state = 'PART_TO_ESTIMATE') as waiting_for_parts
from pilot_work_order;

select w."quoteNumber", w."contractNo", string_agg(w."workOrderNumber", ', ') as work_orders,
  (select count(*) from salesforce.quotelineitem l where l.quoteid = w."sfQuoteId") as lines
from (
  select k."contractNo", w.*
  from workorders.work_order w
  join contracts.contract_device cd on cd."deviceId" = w."deviceId" and not cd."isTerminated" and cd."deletedAt" is null
  join contracts.contract k on k.id = cd."contractId"
  where w."quoteStatus" = 'draft' and k."contractNo" in ('00019814', '00016840', '00018461', '00016613', '00014296', '00016179')
) w
group by 1, 2, w."sfQuoteId" order by 1;
