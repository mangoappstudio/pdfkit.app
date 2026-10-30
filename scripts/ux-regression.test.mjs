import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePageRanges } from "../lib/pdf-utils.ts";

// Regression: issue #26, page-range inputs silently accepted partial numbers.
// Found during the 2026-10-30 UX audit; see UX_AUDIT.md.
test("page ranges reject malformed tokens instead of exporting unintended pages", () => {
  for (const input of ["1abc", "1.5", "1-2-3", "1-2foo", "1,,2", ",1", "1,", "", " ", "1e2", "-1", "0", "4", "3-1"]) {
    assert.throws(() => parsePageRanges(input, 3), undefined, input);
  }
});

test("valid page ranges preserve sorting, deduplication and whitespace support", () => {
  assert.deepEqual(parsePageRanges("3, 1 - 2,2", 3), [0, 1, 2]);
  assert.deepEqual(parsePageRanges("2", 3), [1]);
  assert.deepEqual(parsePageRanges("1-3", 3), [0, 1, 2]);
});
