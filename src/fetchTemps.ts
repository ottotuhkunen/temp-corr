const METAR_URL =
  "https://api.met.no/weatherapi/tafmetar/1.0/metar.txt?icao=EFHA,EFHK,EFIV,EFJO,EFJY,EFKE,EFKT,EFKK,EFKU,EFKS,EFMA,EFOU,EFPO,EFRO,EFTP,EFTU,EFVA";

export type AirportTemps = Record<string, number | null>;

export async function fetchLatestTemps(): Promise<AirportTemps> {
  const res = await fetch(METAR_URL);
  const text = await res.text();

  const lines = text.trim().split("\n");
  const latest: Record<string, string> = {};

  // Keep only last METAR per ICAO
  for (const line of lines) {
    const icao = line.slice(0, 4);
    latest[icao] = line;
  }

  const temps: AirportTemps = {};

  for (const [icao, metar] of Object.entries(latest)) {
    // Match: M02/ or 02/
    const tempMatch = metar.match(/\b(M?\d{2})\//);

    if (!tempMatch) {
      temps[icao] = null;
      continue;
    }

    const raw = tempMatch[1]; // "M02" or "02"
    const isNegative = raw.startsWith("M");
    const value = parseInt(raw.replace("M", ""), 10);

    temps[icao] = isNegative ? -value : value;
  }

  return temps;
}
