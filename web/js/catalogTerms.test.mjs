import assert from "node:assert/strict";
import test from "node:test";
import { catalogTerms } from "./catalogTerms.js";
import { translationKeySets } from "./i18n.js";

test("catalog questions keep the product word", () => {
  assert.deepEqual(catalogTerms("what is the serum price"), ["serum"]);
});

test("Bangla filler drops and the product word stays", () => {
  assert.deepEqual(catalogTerms("সিরামের দাম"), ["সিরামের"]);
});

test("English and Bangla use the same copy keys", () => {
  const packs = translationKeySets();
  assert.deepEqual(packs.en, packs.bn);
  assert.ok(packs.en.includes("forYou"));
  assert.ok(packs.en.includes("noComments"));
  assert.ok(!packs.en.includes(""));
});
