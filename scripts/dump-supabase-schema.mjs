// Dumps the public schema of a Supabase project via the Management API.
// Uses a Personal Access Token (no DB password). Output is ordered so the
// resulting SQL is roughly replayable: extensions → enums → tables →
// constraints → indexes → functions → triggers → views → policies → publications.

import { writeFileSync } from 'node:fs'

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF = process.env.SUPABASE_PROJECT_REF
const OUT = process.argv[2] ?? 'supabase/schema_remote.sql'

if (!TOKEN || !REF) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF env vars required')
  process.exit(1)
}

const URL = `https://api.supabase.com/v1/projects/${REF}/database/query`

async function q(sql) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`API ${res.status}: ${text}`)
  return JSON.parse(text)
}

const sections = []
const push = (title, body) => sections.push(`-- ${'─'.repeat(70)}\n-- ${title}\n-- ${'─'.repeat(70)}\n\n${body}`)

console.log('Fetching extensions…')
const exts = await q(`
  select format('CREATE EXTENSION IF NOT EXISTS %I WITH SCHEMA %I;', extname, n.nspname) as ddl
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  where extname not in ('plpgsql')
  order by extname
`)
push('Extensions', exts.map((r) => r.ddl).join('\n') + '\n')

console.log('Fetching enums…')
const enums = await q(`
  select format(E'CREATE TYPE %I.%I AS ENUM (%s);',
    n.nspname, t.typname,
    string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder)
  ) as ddl
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
  group by n.nspname, t.typname
  order by t.typname
`)
push('Enum types', enums.map((r) => r.ddl).join('\n') + '\n')

console.log('Fetching sequences…')
const seqs = await q(`
  select format(E'CREATE SEQUENCE IF NOT EXISTS %I.%I AS %s START WITH %s INCREMENT BY %s%s%s;',
    n.nspname, c.relname, s.seqtypid::regtype::text,
    s.seqstart::text, s.seqincrement::text,
    case when s.seqmin <> 1 then ' MINVALUE ' || s.seqmin::text else '' end,
    case s.seqcycle when true then ' CYCLE' else '' end
  ) as ddl
  from pg_sequence s
  join pg_class c on c.oid = s.seqrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
  order by c.relname
`)
push('Sequences', seqs.length ? seqs.map((r) => r.ddl).join('\n') + '\n' : '-- (none)\n')

console.log('Fetching tables…')
const tables = await q(`
  with cols as (
    select
      n.nspname as schema, c.relname as tbl, a.attnum as pos, a.attname as col,
      pg_catalog.format_type(a.atttypid, a.atttypmod) as typ,
      a.attnotnull as nn,
      pg_get_expr(d.adbin, d.adrelid) as dflt,
      col_description(c.oid, a.attnum) as cmt
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where c.relkind = 'r' and n.nspname = 'public'
      and a.attnum > 0 and not a.attisdropped
  )
  select schema, tbl,
    'CREATE TABLE ' || quote_ident(schema) || '.' || quote_ident(tbl) || E' (\n' ||
    string_agg(
      '  ' || quote_ident(col) || ' ' || typ ||
        case when dflt is not null then ' DEFAULT ' || dflt else '' end ||
        case when nn then ' NOT NULL' else '' end,
      E',\n' order by pos
    ) ||
    E'\n);' as ddl
  from cols
  group by schema, tbl
  order by tbl
`)
push('Tables', tables.map((r) => r.ddl).join('\n\n') + '\n')

console.log('Fetching constraints…')
const cons = await q(`
  select format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s;',
    n.nspname, c.relname, con.conname,
    pg_get_constraintdef(con.oid)
  ) as ddl,
  case con.contype when 'p' then 1 when 'u' then 2 when 'c' then 3 when 'f' then 4 else 5 end as ord
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
  order by ord, con.conname
`)
push('Constraints (PK, FK, unique, check)', cons.map((r) => r.ddl).join('\n') + '\n')

console.log('Fetching indexes…')
const idx = await q(`
  select pg_get_indexdef(i.indexrelid) || ';' as ddl
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not i.indisprimary and not i.indisunique
  order by c.relname
`)
push('Indexes (non-PK, non-unique)', idx.map((r) => r.ddl).join('\n') + '\n')

console.log('Fetching functions…')
const fns = await q(`
  select pg_get_functiondef(p.oid) || ';' as ddl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f','p')
  order by p.proname
`)
push('Functions / procedures', fns.map((r) => r.ddl).join('\n\n') + '\n')

console.log('Fetching triggers…')
const trigs = await q(`
  select pg_get_triggerdef(t.oid, true) || ';' as ddl
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
  order by c.relname, t.tgname
`)
push('Triggers', trigs.map((r) => r.ddl).join('\n') + '\n')

console.log('Fetching views…')
const views = await q(`
  select format(E'CREATE OR REPLACE VIEW %I.%I AS\n%s', n.nspname, c.relname, pg_get_viewdef(c.oid, true)) as ddl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
  order by c.relname
`)
push('Views', views.length ? views.map((r) => r.ddl).join('\n\n') + '\n' : '-- (none)\n')

console.log('Fetching RLS state + policies…')
const rls = await q(`
  select format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', n.nspname, c.relname) as ddl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  order by c.relname
`)
const policies = await q(`
  select format(
    'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
    policyname, schemaname, tablename,
    case permissive when 'PERMISSIVE' then 'PERMISSIVE' else 'RESTRICTIVE' end,
    cmd,
    array_to_string(roles, ', '),
    case when qual is not null then ' USING (' || qual || ')' else '' end,
    case when with_check is not null then ' WITH CHECK (' || with_check || ')' else '' end
  ) as ddl
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname
`)
push('Row-Level Security', rls.map((r) => r.ddl).join('\n') + '\n\n' + policies.map((r) => r.ddl).join('\n') + '\n')

console.log('Fetching realtime publication…')
const pub = await q(`
  select format('ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I;', schemaname, tablename) as ddl
  from pg_publication_tables
  where pubname = 'supabase_realtime'
  order by tablename
`)
push('Realtime publication', pub.length ? pub.map((r) => r.ddl).join('\n') + '\n' : '-- (none)\n')

console.log('Fetching storage buckets…')
const buckets = await q(`
  select format(E'INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (%L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
    id, name, public::text, file_size_limit::text, allowed_mime_types::text
  ) as ddl
  from storage.buckets
  order by id
`)
push('Storage buckets', buckets.length ? buckets.map((r) => r.ddl).join('\n') + '\n' : '-- (none)\n')

const header = `-- Sparks Supabase remote schema dump
-- Project: ${REF}
-- Generated: ${new Date().toISOString()}
-- Source: Supabase Management API (no DB password used)
-- Note: Schemas auth/storage/realtime managed by Supabase are not included.
--       Run blocks in order. Idempotency is best-effort.

`

writeFileSync(OUT, header + sections.join('\n\n'))
console.log(`\nWrote ${OUT}`)
