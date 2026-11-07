# Local PostgreSQL schema baseline

**Scope and date:** read-only inspection of the local PostgreSQL database identified by `.env.example:10–13` on 2026-11-07. The project owner selected this local database as the SRS physical schema baseline. This is a schema snapshot, not application runtime verification or evidence about another deployment. No data rows were read or changed.

## Observed catalog

| Observation | Result | Source comparison |
|---|---:|---|
| Application tables | 43 | 43 `model` declarations in `prisma/schema.prisma:237–1083`. |
| Total public base tables | 44 | Includes `_prisma_migrations`. |
| Public table columns | 415 | Every Prisma scalar and enum field has a matching column name; no extra application-table columns were found. |
| PostgreSQL enums | 30 | Enum names and values match the 30 declarations in `prisma/schema.prisma:14–235`. |
| Foreign-key constraints | 73 | Catalog count; relationship detail remains grounded in `prisma/schema.prisma:237–1083`. |
| Migration history | 2 finished, 0 rolled back | `20261102000000_initial` and `20261107000000_align_schema`, corresponding to `prisma/migrations/20261102000000_initial/migration.sql:1` and `prisma/migrations/20261107000000_align_schema/migration.sql:1–120`. |

## Read-only method

Used `PrismaClient` with the `DATABASE_URL` value parsed from `.env.example` (the credential was not printed) to query `information_schema.tables`, `information_schema.columns`, `information_schema.table_constraints`, `pg_type`/`pg_enum`, and `_prisma_migrations`. Compared the results with `Prisma.dmmf.datamodel.models` and `.enums` from the installed generated client. The first column comparison counted scalar fields only and therefore showed enum columns as extras; rerunning it with both scalar and enum fields produced **no model-column differences**. The enum name/value comparison also produced **no differences**.

## Limits

- This inspection did not compare column data types, nullability, defaults, indexes, checks, triggers, or live data. The SRS should cite `prisma/schema.prisma` and migration SQL for those details until a focused catalog comparison is made.
- The generated Prisma client and local database agree on table names, column names and enum values at this snapshot. This does not establish that a separate deployed database has the same structure.
- The alignment migration is still untracked in the repository working tree, even though the local database records it as finished (`prisma/migrations/20261107000000_align_schema/migration.sql:1–120`).
