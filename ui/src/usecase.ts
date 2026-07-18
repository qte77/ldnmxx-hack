// Resolve which usecase runs from the ?usecase= query param. Falls back to the flagship
// (Sort My Care) when the param is absent or names an unknown id — so the civic default stays
// calm and single-purpose, while ?usecase=founders-copilot still reaches the engine demo.
export function readUsecase(
  search: string,
  knownIds: readonly string[],
  fallbackId: string,
): string {
  const requested = new URLSearchParams(search).get("usecase");
  return requested !== null && knownIds.includes(requested) ? requested : fallbackId;
}
