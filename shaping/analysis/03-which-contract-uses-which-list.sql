-- Which contracts does each list really apply to?
-- Findings: the Lindenhome list matches Lindenhome AL's main contract 00019814
-- (157 devices), not only the small 00016840. Meridian's Table A matches most
-- sibling malls, but North Gem and Ardmoor charge item 38 at other prices, so
-- they are not linked until WeMaintain confirms (interviewer question 5).
\ir 00-load-price-lists.sql

-- The contract behind each quote line, through the quote's work orders.
create temp view line_contract as
select l.*, (
  select k."contractNo"
  from salesforce.repair_request__c r
  join workorders.work_order w on w.id::text = r.rrid__c
  join contracts.contract_device cd on cd."deviceId" = w."deviceId" and not cd."isTerminated" and cd."deletedAt" is null
  join contracts.contract k on k.id = cd."contractId"
  where r.quote__c = l.quote_id limit 1
) as contract
from client_line l;

-- Lindenhome AL: lines citing a list code at the list price, per contract.
select contract, count(*) as lines,
  count(*) filter (where exists (
    select 1 from lindenhome lh where l.text ~ lh.code and lh.price ~ '^[0-9.]+$' and abs(lh.price::numeric - l.unit_price) < 0.01
  )) as code_at_list_price
from line_contract l where l.account = 'Lindenhome AL' group by 1 order by 2 desc;

-- Meridian group: lines priced at a Table A price, per account and contract.
select left(account, 30) as account, contract, count(*) as lines,
  count(*) filter (where exists (select 1 from meridian m where l.unit_price in (m.office, m.after_hours, m.weekend))) as at_table_a_price
from line_contract l where l.account not ilike 'lindenhome%' group by 1, 2 order by 1, 2;

-- Item 38 (escalator step chain) at night: Table A says SGD 23,774.
select q.quotenumber, a.name as account, l.unitprice, l.quantity
from salesforce.quotelineitem l
join salesforce.quote q on q.id = l.quoteid
join salesforce.account a on a.id = q.accountid
where (l.quote_line_description__c ~* 'item.?-?38|SOR 38' or l.quotepdf_productname__c ~* 'step chain')
  and a.name ilike any (array['%meridian%', '%serava%', '%mr retail%'])
order by q.createddate;
