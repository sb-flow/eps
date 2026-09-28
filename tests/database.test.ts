import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { importLegacy } from "../lib/import-legacy";
test("SQL migrations, transactional real import, idempotency, audit and role isolation", async () => {
  const db = new PGlite({ extensions: { pg_trgm } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
    );
    for (const name of [
      "001_crm.sql",
      "002_transactions.sql",
      "003_integrity.sql",
    ])
      await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
    const { data } = importLegacy(
      JSON.parse(readFileSync("data/projects.json", "utf8")),
      JSON.parse(readFileSync("data/participants.json", "utf8")),
    );
    await db.query("select import_legacy($1)", [JSON.stringify(data)]);
    await db.query("select import_legacy($1)", [JSON.stringify(data)]);
    assert.equal(
      (await db.query<{ n: number }>("select count(*)::int as n from projects"))
        .rows[0].n,
      372,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int as n from companies",
        )
      ).rows[0].n,
      data.companies.length,
    );
    await db.exec(
      `insert into auth.users values('11111111-1111-4111-a111-111111111111','viewer@test'),('22222222-2222-4222-a222-222222222222','manager@test'),('33333333-3333-4333-a333-333333333333','admin@test');update profiles set role='manager' where id='22222222-2222-4222-a222-222222222222';update profiles set role='admin' where id='33333333-3333-4333-a333-333333333333';set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-a111-111111111111';`,
    );
    assert.equal((await db.query("select id from projects")).rows.length, 372);
    assert.equal(
      (
        await db.query(
          "update projects set name='Forbidden' where id='city-001' returning id",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(() =>
      db.exec(
        "insert into companies(name,normalized_name) values('Forbidden','forbidden')",
      ),
    );
    assert.equal(
      (
        await db.query(
          "update profiles set role='admin' where id=auth.uid() returning id",
        )
      ).rows.length,
      0,
    );
    await db.exec(
      "set request.jwt.claim.sub='22222222-2222-4222-a222-222222222222'",
    );
    await db.exec("update projects set name='Updated' where id='city-001'");
    assert.equal(
      (
        await db.query<{ name: string }>(
          "select name from projects where id='city-001'",
        )
      ).rows[0].name,
      "Updated",
    );
    await assert.rejects(() => db.exec("delete from history"));
    assert.equal(
      (
        await db.query(
          "update profiles set role='admin' where id=auth.uid() returning id",
        )
      ).rows.length,
      0,
    );
    const company = (
      await db.query<{ id: string }>(
        "insert into companies(name,normalized_name) values('Test company','test company') returning id",
      )
    ).rows[0].id;
    const person = (
      await db.query<{ id: string }>(
        "insert into people(first_name,company_id,phone) values('Test contact',$1,'+998000000000') returning id",
        [company],
      )
    ).rows[0].id;
    await db.query("select add_participant($1,$2)", [
      JSON.stringify({
        project_id: "city-001",
        company_id: company,
        role: "Проектировщик",
        person_id: person,
      }),
      ["ИТП", "ОВ"],
    ]);
    assert.equal(
      (
        await db.query(
          "select * from project_sections where project_id='city-001'",
        )
      ).rows.length,
      2,
    );
    const specification = (
      await db.query<{ id: string }>(
        "insert into specifications(project_id,section,name,storage_path,status,uploader) values('city-001','ИТП','test.xlsx','city-001/test.xlsx','processing',auth.uid()) returning id",
      )
    ).rows[0].id;
    await db.query("select complete_specification($1,$2)", [
      specification,
      JSON.stringify([
        { original_name: "Клапан DN50", quantity: 4, dn: 50, confidence: 0.9 },
      ]),
    ]);
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from specifications where id=$1",
          [specification],
        )
      ).rows[0].status,
      "parsed",
    );
    assert.equal(
      (
        await db.query(
          "select * from specification_items where specification_id=$1",
          [specification],
        )
      ).rows.length,
      1,
    );
    await assert.rejects(() =>
      db.query("select complete_specification($1,$2)", [specification, "[]"]),
    );
    await db.query("select save_calculation($1,$2,$3)", [
      JSON.stringify({
        project_id: "city-001",
        section: "ИТП",
        name: "Test calculation",
        value_type: "estimated",
        currency: "UZS",
        amount: 602,
      }),
      JSON.stringify({ quantity: 4, purchase_price: 100, markup: 25, vat: 12 }),
      JSON.stringify({
        quantity: 4,
        purchase_price: 100,
        margin: 20,
        total: 602,
      }),
    ]);
    assert.equal(
      (
        await db.query<{ amount: string }>(
          "select amount from opportunities where project_id='city-001'",
        )
      ).rows[0].amount,
      "602",
    );
    await db.exec(
      "reset role;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-a111-111111111111'",
    );
    await assert.rejects(() =>
      db.exec(
        "insert into storage.objects(bucket_id,name) values('specifications','city-001/file.pdf')",
      ),
    );
    await db.exec(
      "set request.jwt.claim.sub='22222222-2222-4222-a222-222222222222';insert into storage.objects(bucket_id,name) values('specifications','city-001/file.pdf')",
    );
    await assert.rejects(() =>
      db.exec(
        "insert into storage.objects(bucket_id,name) values('specifications','missing-project/file.pdf')",
      ),
    );
    await db.exec(
      "set request.jwt.claim.sub='11111111-1111-4111-a111-111111111111'",
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await assert.rejects(() => db.exec("select import_legacy('{}')"));
    await db.exec("reset role");
    await db.query("select import_legacy($1)", [JSON.stringify(data)]);
    assert.equal(
      (
        await db.query<{ name: string }>(
          "select name from projects where id='city-001'",
        )
      ).rows[0].name,
      "Updated",
    );
    assert.ok(
      (
        await db.query(
          "select * from history where entity='projects' and operation='UPDATE' and user_id='22222222-2222-4222-a222-222222222222'",
        )
      ).rows.length > 0,
    );
  } finally {
    await db.close();
  }
});
