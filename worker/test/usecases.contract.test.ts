import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import { assertUsecaseDef } from "../src/usecases";

// Vendored from qte77/protocols@workflow-definition/v1.0.0 via scripts/sync.sh's layout (see
// worker/test/fixtures/contract/). Re-sync by re-running sync.sh at a newer tag, not by hand-editing here.
const here = dirname(fileURLToPath(import.meta.url));
const contractDir = join(here, "fixtures/contract");
const usecasesDir = join(here, "../../usecases");
const invalidDir = join(contractDir, "fixtures/workflow-definition/v1/invalid");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

const schema = readJson(join(contractDir, "schemas/workflow-definition/v1/workflow-definition.schema.json"));
const ajv = new Ajv2020({ strict: false });
const validateSchema = ajv.compile(schema as object);

const usecaseFiles = readdirSync(usecasesDir).filter((f) => f.endsWith(".json"));
const invalidFixtures = readdirSync(invalidDir).filter((f) => f.endsWith(".json"));

// Every shipped usecase def is a valid workflow-definition/v1 (the envelope both engines share: a
// non-empty `id` + ordered, non-empty `stages[].name`). This is the "swap a JSON" contract's other half:
// swappable across engines, not just across usecases within this Worker.
describe("usecases/*.json — workflow-definition/v1 contract", () => {
  for (const file of usecaseFiles) {
    it(`${file} validates against the vendored schema`, () => {
      const ok = validateSchema(readJson(join(usecasesDir, file)));
      expect(ok, ajv.errorsText(validateSchema.errors)).toBe(true);
    });
  }
});

// assertUsecaseDef is stricter than the shared schema (it also requires TS-only fields like title/render),
// so it must never accept something the shared contract already calls invalid.
describe("assertUsecaseDef — rejects every vendored invalid/* fixture", () => {
  for (const file of invalidFixtures) {
    it(`rejects ${file}`, () => {
      expect(() => assertUsecaseDef(readJson(join(invalidDir, file)))).toThrow();
    });
  }
});
