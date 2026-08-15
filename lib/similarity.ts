const tokens = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

export function textSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.length || !right.length) return 0;
  const vocabulary = new Set([...left, ...right]);
  const leftCounts = new Map<string, number>();
  const rightCounts = new Map<string, number>();
  left.forEach((token) => leftCounts.set(token, (leftCounts.get(token) ?? 0) + 1));
  right.forEach((token) => rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1));
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  vocabulary.forEach((token) => {
    const l = leftCounts.get(token) ?? 0;
    const r = rightCounts.get(token) ?? 0;
    dot += l * r;
    leftMagnitude += l * l;
    rightMagnitude += r * r;
  });
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
