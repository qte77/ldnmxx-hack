// Whole-word (with a simple plural/possessive tail) phrase match, case-insensitive, NO dynamic RegExp
// (no ReDoS surface). Shared by the router (keyword → workflow) and the place resolver (name/alias →
// coords): "park" matches "park", "parks", "park's" but NOT "parking"; multi-word phrases ("green
// space", "tower of london") match as a whole phrase. `lowerText` MUST already be lower-cased.

function isWordChar(ch: string): boolean {
  return /[a-z0-9]/.test(ch);
}

export function matchesWholeWord(lowerText: string, phrase: string): boolean {
  const p = phrase.toLowerCase();
  let i = lowerText.indexOf(p);
  while (i !== -1) {
    const beforeOk = i === 0 || !isWordChar(lowerText[i - 1] ?? "");
    let end = i + p.length;
    if (lowerText[end] === "'" && lowerText[end + 1] === "s") end += 2; // possessive
    else if (lowerText[end] === "s" && !isWordChar(lowerText[end + 1] ?? "")) end += 1; // simple plural
    if (beforeOk && !isWordChar(lowerText[end] ?? "")) return true;
    i = lowerText.indexOf(p, i + 1);
  }
  return false;
}
