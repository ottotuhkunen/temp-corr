const METAR_URL =
    "https://api.met.no/weatherapi/tafmetar/1.0/metar.txt?icao=EFHA,EFHK,EFIV,EFJO,EFJY,EFKE,EFKT,EFKK,EFKU,EFKS,EFMA,EFOU,EFPO,EFRO,EFTP,EFTU,EFVA";

export type AirportTemps = Record<string, number | null>;

export async function fetchLatestTemps(): Promise<AirportTemps> {
    const res = await fetch(METAR_URL);
    const text = await res.text();

    const lines = text.trim().split("\n");

    const latest: Record<string, string> = {};

    // pick latest METAR per ICAO (the last entry in the text block)
    for (const line of lines) {
        const icao = line.slice(0, 4);
        latest[icao] = line;
    }

    const temps: AirportTemps = {};

    for (const [icao, metar] of Object.entries(latest)) {
        // Try negative temperature first: M09, M15, M02 etc.
        const negMatch = metar.match(/M(\d{2}) /);

        if (negMatch) {
            temps[icao] = -parseInt(negMatch[1], 10);
            continue;
        }

        // Positive temperature: 03/02 or 09/08 etc.
        const posMatch = metar.match(/(\d{2})\//);

        if (posMatch) {
            temps[icao] = parseInt(posMatch[1], 10);
            continue;
        }

        // If no temp found → treat as positive (no correction)
        temps[icao] = null;
    }

    return temps;
}
