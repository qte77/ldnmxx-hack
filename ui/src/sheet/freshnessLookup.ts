// 024 P6 (design-match): the sheet's meta row ("Source: X · Updated Y") needs ONE corpus's asOf date
// out of GET /api/freshness's full corpora list — pure array lookup, mirrors coverage.ts's pattern
// (pure logic tested here, the fetch/parse glue lives in useFreshnessDate.ts, untested per convention).

export interface FreshnessRow {
  corpus: string;
  asOf: string | null;
}

// Honestly null when there is no freshnessKey to look up, or no matching row — never guesses at the
// freshest/any row, and never surfaces a stale-but-present date under the wrong corpus's name.
export function lookupAsOf(corpora: readonly FreshnessRow[], freshnessKey: string | undefined): string | null {
  if (!freshnessKey) return null;
  return corpora.find((c) => c.corpus === freshnessKey)?.asOf ?? null;
}
