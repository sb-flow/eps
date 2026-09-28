begin;
create function public.add_participant(payload jsonb,sections text[]) returns uuid language plpgsql security invoker set search_path=public as $$
declare pid uuid;begin
 if public.crm_role() not in ('admin','manager') or public.crm_role() is null then raise exception 'Forbidden';end if;
 insert into project_participants(project_id,company_id,role,person_id,comment,source,verified_at) values(payload->>'project_id',(payload->>'company_id')::uuid,payload->>'role',nullif(payload->>'person_id','')::uuid,payload->>'comment',payload->>'source',nullif(payload->>'verified_at','')::date) returning id into pid;
 insert into project_participant_sections(participant_id,section) select pid,unnest(sections);
 insert into project_sections(project_id,section) select payload->>'project_id',unnest(sections) on conflict do nothing;return pid;
end $$;
create function public.complete_specification(spec_id uuid,items jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from specifications where id=spec_id and status='processing' for update;
 if not found then raise exception 'Specification not processing';end if;
 delete from specification_items where specification_id=spec_id;
 insert into specification_items(specification_id,original_name,normalized_name,section,category,manufacturer,model,article,dn,pn,kvs,voltage,power,unit,quantity,technical_parameters,notes,confidence)
 select spec_id,x.original_name,x.normalized_name,x.section,x.category,x.manufacturer,x.model,x.article,x.dn,x.pn,x.kvs,x.voltage,x.power,x.unit,x.quantity,x.technical_parameters,x.notes,x.confidence from jsonb_populate_recordset(null::specification_items,items) x;
 update specifications set status='parsed',error_code=null where id=spec_id;
end $$;
create function public.save_calculation(opp jsonb,calc jsonb,item jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare oid uuid;cid uuid;begin
 insert into opportunities(project_id,section,name,value_type,currency,amount) values(opp->>'project_id',opp->>'section',opp->>'name',opp->>'value_type',opp->>'currency',(opp->>'amount')::numeric) returning id into oid;
 insert into calculations(opportunity_id,project_id,currency,parameters,created_by) values(oid,opp->>'project_id',opp->>'currency',calc,auth.uid()) returning id into cid;
 insert into calculation_items(calculation_id,specification_item_id,quantity,purchase_price,currency,sales_price,delivery,customs_duty,certification,vat,markup,margin,additional_costs,total,parameters)
 values(cid,nullif(item->>'specification_item_id','')::uuid,(item->>'quantity')::numeric,(item->>'purchase_price')::numeric,opp->>'currency',(item->>'sales_price')::numeric,(item->>'delivery')::numeric,(item->>'customs_duty')::numeric,(item->>'certification')::numeric,(item->>'vat')::numeric,(item->>'markup')::numeric,(item->>'margin')::numeric,(item->>'additional_costs')::numeric,(item->>'total')::numeric,calc);return oid;
end $$;
revoke all on function public.add_participant(jsonb,text[]),public.complete_specification(uuid,jsonb),public.save_calculation(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.add_participant(jsonb,text[]),public.complete_specification(uuid,jsonb),public.save_calculation(jsonb,jsonb,jsonb) to authenticated;
commit;
