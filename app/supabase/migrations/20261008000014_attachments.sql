-- =============================================================================
-- Nexus MRO · Phase 1 · 0014 Attachments (photos and scanned documents)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   * Files (photos of a defect, scanned sign-off cards, tech log pages,
--     logbook entries, MEL documents) are stored in a private file store on
--     the operator's own server.
--   * ONLY PDF and images are accepted (D-026), up to 20 MB each. Anything
--     else (e.g. a program file) is refused by the file store itself.
--   * Each file is linked to one record (a snag, a work order...). You can see
--     a file only if you can see its record: the same locks apply (D-125).
--   * Files are never deleted or overwritten (D-023). A wrong file is marked
--     superseded by a new one; both stay on record.
--
--   File names in the store follow: <record type>/<record id>/<file name>
-- =============================================================================

-- The private file store ("bucket"), with its own type and size limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.attachment (
  id             uuid primary key default gen_random_uuid(),
  record_table   text not null check (record_table in
                   ('snag', 'work_order', 'nadd', 'ddls_entry', 'mel_revision', 'technical_query')),
  record_id      uuid not null,
  kind           text not null check (kind in
                   ('photo', 'document', 'sign_off_card', 'tech_log_page',
                    'aircraft_logbook', 'engine_logbook', 'mel_document')),
  file_name      text not null,
  mime_type      text not null check (mime_type in
                   ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic')),  -- D-026
  size_bytes     bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  storage_path   text not null unique,
  uploaded_by    uuid not null references public.person (id),
  superseded_by  uuid references public.attachment (id),
  superseded_reason text,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  device_time    timestamptz,
  constraint path_matches_record check (storage_path like record_table || '/' || record_id::text || '/%'),
  constraint supersede_reason check (superseded_by is null or length(trim(coalesce(superseded_reason, ''))) > 0)
);
comment on table public.attachment is 'Files linked to records. PDF and images only (D-026). Never deleted; superseded instead (D-023).';
select app.apply_standard_rules('public.attachment');

-- -----------------------------------------------------------------------------
-- "Can the signed-in user see this record?" Runs with the USER's rights (not
-- the owner's), so the record's own locks decide. Table names are limited to
-- the list allowed in attachment.record_table.
-- -----------------------------------------------------------------------------
create or replace function app.can_see_record(p_table text, p_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if p_table not in ('snag', 'work_order', 'nadd', 'ddls_entry', 'mel_revision', 'technical_query') then
    return false;
  end if;
  execute format('select exists (select 1 from public.%I where id = $1)', p_table) into v_ok using p_id;
  return v_ok;
end;
$$;

-- Before saving: the uploader is the signed-in person; only "superseded"
-- fields may ever change afterwards.
create or replace function app.check_attachment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.uploaded_by := app.current_person_id();
    end if;
    new.superseded_by := null; new.superseded_reason := null;
    return new;
  end if;
  if (to_jsonb(new) - array['superseded_by','superseded_reason','created_at','created_by'])
     is distinct from (to_jsonb(old) - array['superseded_by','superseded_reason','created_at','created_by']) then
    raise exception 'A file record cannot be edited; upload a new file and mark this one superseded (D-023).'
      using errcode = 'P0001';
  end if;
  if old.superseded_by is not null then
    raise exception 'This file is already superseded.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger a0_check_attachment before insert or update on public.attachment
  for each row execute function app.check_attachment();

alter table public.attachment enable row level security;
create policy read_if_record_visible on public.attachment for select to authenticated
  using (app.can_see_record(record_table, record_id));
create policy add_if_record_visible on public.attachment for insert to authenticated
  with check (app.current_person_id() is not null and app.can_see_record(record_table, record_id));
create policy supersede_own_or_eng on public.attachment for update to authenticated
  using (app.can_see_record(record_table, record_id)
         and (uploaded_by = app.current_person_id() or app.has_department('ENG') or app.has_department('QUA')))
  with check (app.can_see_record(record_table, record_id));
revoke delete, truncate on public.attachment from anon, authenticated, service_role;
revoke all on public.attachment from anon;

-- -----------------------------------------------------------------------------
-- File store locks. Upload into a record's folder only if you can see that
-- record; read a file only if its attachment record is visible to you.
-- No update or delete rules exist, so files can never be replaced or removed.
-- -----------------------------------------------------------------------------
create policy nexus_attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments'
         and exists (select 1 from public.attachment a where a.storage_path = storage.objects.name));

create policy nexus_attachments_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and app.current_person_id() is not null
              and (storage.foldername(name))[1] in ('snag', 'work_order', 'nadd', 'ddls_entry', 'mel_revision', 'technical_query')
              and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
              and app.can_see_record((storage.foldername(name))[1], ((storage.foldername(name))[2])::uuid));
