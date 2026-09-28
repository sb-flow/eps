begin;
-- Enforce same-company contacts even for writes directly through the Supabase API.
create function public.check_participant_person() returns trigger language plpgsql set search_path=public as $$ begin
 if new.person_id is not null and not exists(select 1 from people where id=new.person_id and company_id=new.company_id) then raise exception 'Contact must belong to participant company';end if;return new;end $$;
create trigger valid_person before insert or update on project_participants for each row execute function check_participant_person();
-- Assign nested changes to their owning project for a complete project history.
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path=public as $$
declare before_row jsonb;after_row jsonb;r jsonb;pid text;begin
 if TG_OP<>'INSERT' then before_row=to_jsonb(old);end if;
 if TG_OP<>'DELETE' then after_row=to_jsonb(new);end if;
 r=coalesce(after_row,before_row);pid=r->>'project_id';
 if TG_TABLE_NAME='projects' then pid=r->>'id';
 elsif TG_TABLE_NAME='project_participant_sections' then select project_id into pid from project_participants where id=(r->>'participant_id')::uuid;
 elsif TG_TABLE_NAME='specification_items' then select project_id into pid from specifications where id=(r->>'specification_id')::uuid;
 elsif TG_TABLE_NAME='product_matches' then select s.project_id into pid from specifications s join specification_items i on i.specification_id=s.id where i.id=(r->>'specification_item_id')::uuid;
 elsif TG_TABLE_NAME='calculation_items' then select project_id into pid from calculations where id=(r->>'calculation_id')::uuid;
 end if;
 insert into history(entity,entity_id,project_id,user_id,operation,old_value,new_value) values(TG_TABLE_NAME,r->>'id',pid,auth.uid(),TG_OP,before_row,after_row);
 return coalesce(new,old);end $$;
commit;
