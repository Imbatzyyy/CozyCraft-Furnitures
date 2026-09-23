// One scoped migration; does not repair or replay unrelated mobile migrations.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
if (
  readFileSync("supabase/.temp/project-ref", "utf8").trim() !==
  "gwjsivqksyimuabbdyqq"
)
  throw new Error("Unexpected linked project");
const version = process.argv.includes("--queue")
  ? "20260923093000"
  : "20260923090000";
const name = process.argv.includes("--queue")
  ? "furniture_photo_index_queue"
  : "furniture_visual_discovery";
const migration = readFileSync(
  `supabase/migrations/${version}_${name}.sql`,
  "utf8",
);
const apply = process.argv.includes("--apply");
const sql = `begin; ${migration}\n${apply ? `insert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${name}',array[$m$${migration}$m$]); notify pgrst,'reload schema'; commit;` : "rollback;"} select '${apply ? "Applied" : "Validated and rolled back"}' as result;`;
process.stdout.write(
  execFileSync("npx", ["supabase", "db", "query", "--linked", sql], {
    encoding: "utf8",
    maxBuffer: 1000000,
  }),
);
