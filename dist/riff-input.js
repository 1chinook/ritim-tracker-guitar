// Her parça tek bir adımdır: perde numarası veya sus için "-" / "r".
export function parseRiff(source, string) {
  const tokens = source.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length)
    throw new Error("Önce perde numaralarını yaz. Örnek: 0 3 5 7");
  if (tokens.length > 128) throw new Error("En fazla 128 adım ekleyebilirsin.");
  if (!Number.isInteger(string) || string < 1 || string > 6)
    throw new Error("Önce bir tel seç.");
  return tokens.map((token) => {
    if (/^(?:-|r)$/i.test(token)) return null;
    if (!/^\d{1,2}$/.test(token) || Number(token) > 24)
      throw new Error("0–24 arasında perdeler yaz; sus için - kullan.");
    return { string, fret: Number(token), techniques: [] };
  });
}
