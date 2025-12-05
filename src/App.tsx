import { Info, AlertTriangle, Airplay, CheckCircle } from "lucide-react";
import { type AirportTemps, fetchLatestTemps } from "./fetchTemps";
import { useEffect, useState } from "react";

const airports: Airport[] = [
  {
    icao: "EFHA",
    name: "HALLI",
    elevationFt: 481,
    corrections: [
      { name: "TMA SMAC", feet: 2700 },
      { name: "CTR SMAC", feet: 2000 },
    ],
  },
  {
    icao: "EFHK",
    name: "HELSINKI‑VANTAA",
    elevationFt: 180,
    corrections: [
      { name: "IAF 04L", feet: 2300 },
      { name: "IAF 04R", feet: 3300 },
      { name: "IAF 15/22R", feet: 2000 },
      { name: "IAF 22L/33", feet: 3000 },
    ],
  },
  {
    icao: "EFIV",
    name: "IVALO",
    elevationFt: 482,
    corrections: [
      { name: "TMA SMAC", feet: 3600 },
      { name: "CTR SMAC", feet: 3000 },
    ],
  },
  {
    icao: "EFJO",
    name: "JOENSUU",
    elevationFt: 399,
    corrections: [
      { name: "IAF", feet: 2900 },
      { name: "IAF ILS X", feet: 4000 },
      { name: "TMA SMAC", feet: 2500 },
    ],
  },
  {
    icao: "EFJY",
    name: "JYVÄSKYLÄ",
    elevationFt: 460,
    corrections: [
      { name: "IAF", feet: 2900 },
      { name: "TMA SMAC", feet: 2500 },
      { name: "CTR SMAC", feet: 2100 },
    ],
  },
  {
    icao: "EFKE",
    name: "KEMI‑TORNIO",
    elevationFt: 62,
    corrections: [{ name: "TMA SMAC", feet: 2500 }],
  },
  {
    icao: "EFKT",
    name: "KITTILÄ",
    elevationFt: 645,
    corrections: [
      { name: "TMA SMAC", feet: 3800 },
      { name: "CTR SMAC", feet: 3100 },
    ],
  },
  {
    icao: "EFKK",
    name: "KOKKOLA‑PIETARSAARI",
    elevationFt: 85,
    corrections: [
      { name: "IAF", feet: 2400 },
      { name: "TMA SMAC", feet: 2100 },
    ],
  },
  {
    icao: "EFKU",
    name: "KUOPIO",
    elevationFt: 324,
    corrections: [
      { name: "IAF", feet: 2700 },
      { name: "TMA/CTR SMAC", feet: 2100 },
      { name: "S05 SMAC", feet: 2700 },
    ],
  },
  {
    icao: "EFKS",
    name: "KUUSAMO",
    elevationFt: 868,
    corrections: [{ name: "TMA/CTR SMAC", feet: 3000 }],
  },
  {
    icao: "EFMA",
    name: "MARIEHAMN",
    elevationFt: 18,
    corrections: [
      { name: "IAF", feet: 2000 },
      { name: "TMA SMAC", feet: 1900 },
    ],
  },
  {
    icao: "EFOU",
    name: "OULU",
    elevationFt: 48,
    corrections: [
      { name: "IAF", feet: 2300 },
      { name: "TMA SMAC", feet: 2100 },
      { name: "CTR SMAC", feet: 1800 },
    ],
  },
  {
    icao: "EFPO",
    name: "PORI",
    elevationFt: 45,
    corrections: [{ name: "TMA SMAC", feet: 2200 }],
  },
  {
    icao: "EFRO",
    name: "ROVANIEMI",
    elevationFt: 643,
    corrections: [
      { name: "IAF", feet: 2500 },
      { name: "TMA/CTR SMAC", feet: 2400 },
    ],
  },
  {
    icao: "EFTP",
    name: "TAMPERE‑PIRKKALA",
    elevationFt: 391,
    corrections: [
      { name: "IAF", feet: 2700 },
      { name: "TMA SMAC", feet: 2300 },
      { name: "CTR SMAC", feet: 2000 },
    ],
  },
  {
    icao: "EFTU",
    name: "TURKU",
    elevationFt: 162,
    corrections: [{ name: "TMA SMAC", feet: 2200 }],
  },
  {
    icao: "EFVA",
    name: "VAASA",
    elevationFt: 21,
    corrections: [{ name: "TMA SMAC", feet: 2300 }],
  },
];

const LAPSE_RATE_C_PER_FT = 0.00198; // 0.00198 °C / ft (L0)

// Types
type CorrectionPoint = { name: string; feet: number; mocFt?: number };
type Airport = {
  icao: string;
  name: string;
  elevationFt: number;
  corrections: CorrectionPoint[];
};
type CTCRow = { range: string; correctedFt: number; correctedM: number };

function icaoTempCorrection(
  publishedFt: number,
  elevationFt: number,
  tempC: number,
): number {
  const H = publishedFt - elevationFt;
  if (H <= 0) return publishedFt;

  const L0 = LAPSE_RATE_C_PER_FT;
  const t0 = tempC + L0 * elevationFt;
  const correction = H * ((15 - t0) / (273 + t0 - 0.5 * L0 * H));
  const corrected = elevationFt + H + correction;

  return Math.max(corrected, publishedFt); // never below published
}

function buildCTCTable(
  publishedFt: number,
  elevationFt: number,
  mocFt = 1001,
): CTCRow[] {
  const MIN_TEMP_STEP = 0.1; // iterate 0.1°C
  const MIN_TEMP_C = -50; // lowest temp
  const MAX_TEMP_C = 0; // starting point (optional)

  const rows: CTCRow[] = [];
  let lastCorrected: number | null = null;
  let rangeHigh: number | null = null;
  let firstValidTemp: number | null = null;

  for (let tempC = MAX_TEMP_C; tempC >= MIN_TEMP_C; tempC -= MIN_TEMP_STEP) {
    const corrected = icaoTempCorrection(publishedFt, elevationFt, tempC);

    // ROUND UP TO NEAREST 100 FEET
    const rounded = Math.ceil(corrected / 100) * 100;

    if (firstValidTemp === null) firstValidTemp = rangeHigh;

    const minCorrection = 0.2 * mocFt;

    // skip corrections below 20% MOC
    if (rounded - publishedFt < minCorrection) continue;

    if (lastCorrected === null) {
      lastCorrected = rounded;
      rangeHigh = tempC;
    } else if (rounded !== lastCorrected) {
      // Push previous range
      rows.push({
        range: `${Math.ceil(rangeHigh! + 1).toFixed(0)}.1 … ${Math.ceil(tempC + 1).toFixed(0)}`,
        correctedFt: lastCorrected,
        correctedM: Math.ceil((lastCorrected * 0.3048) / 10) * 10,
      });
      lastCorrected = rounded;
      rangeHigh = tempC;
    }
  }

  // push first range
  if (firstValidTemp !== null) {
    rows.unshift({
      range: `… ${Math.ceil(firstValidTemp! + 1).toFixed(0)}`,
      correctedFt: publishedFt,
      correctedM: Math.ceil((publishedFt * 0.3048) / 10) * 10,
    });
  }

  // push last range
  if (lastCorrected !== null && rangeHigh !== null) {
    rows.push({
      range: `${Math.ceil(rangeHigh + 1).toFixed(0)}.1 … -50`,
      correctedFt: lastCorrected,
      correctedM: Math.ceil((lastCorrected * 0.3048) / 10) * 10,
    });
  }

  return rows.map((r) => ({
    range: r.range,
    correctedFt: r.correctedFt,
    correctedM: r.correctedM,
  }));
}

// UI component
export default function App(): JSX.Element {
  const [temps, setTemps] = useState<AirportTemps>({});
  const [loadingTemps, setLoadingTemps] = useState(true);

  useEffect(() => {
    fetchLatestTemps()
      .then((t) => setTemps(t))
      .finally(() => setLoadingTemps(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 to-neutral-950 text-white p-8 font-sans">
      <div className="flex gap-3 items-center justify-center mb-6">
        <img src={"icon.svg"} alt="logo icon" className="w-11" />
        <div>
          <h1 className="text-2xl font-bold text-center">Lämpötilakorjaus</h1>
          <h2 className="text-gray-400">VATSIM Scandinavia</h2>
        </div>
      </div>

      <div className="mb-6 space-y-4 text-sm text-gray-100">
        <div className="flex items-start border-l-4 border-yellow-400 bg-neutral-800/60 p-3 rounded-lg shadow">
          <AlertTriangle className="mr-3 text-yellow-400 w-5 h-5 flex-shrink-0" />
          <p className="text-yellow-400 font-semibold">
            Vain simulaattorikäyttöön VATSIM-verkostossa.
          </p>
        </div>

        <div className="flex items-start border-l-4 border-blue-400 bg-neutral-800/60 p-3 rounded-lg shadow">
          <Info className="mr-3 text-blue-400 w-5 h-5 flex-shrink-0" />
          <p className="text-gray-400">
            Lämpötilakorjausta sovelletaan, kun korjauksen arvo on yli 20%
            vaadittavasta minimiestevarasta.
          </p>
        </div>

        <div className="flex items-start border-l-4 border-cyan-400 bg-neutral-800/60 p-3 rounded-lg shadow">
          <Airplay className="mr-3 text-cyan-400 w-5 h-5 flex-shrink-0" />
          <p className="text-gray-400">
            Annettaessa valvontapalvelua IFR-lennolle, lennonjohtaja huolehtii
            minimiestevaran säilymisestä. Lennonjohtaja huomioi lämpötilan
            vaikutuksen aina, kun lämpötila lentopaikalla on alle 0°C.
          </p>
        </div>

        <div className="flex items-start border-l-4 border-green-400 bg-neutral-800/60 p-3 rounded-lg shadow">
          <CheckCircle className="mr-3 text-green-400 w-5 h-5 flex-shrink-0" />
          <p className="text-gray-400">
            Mikäli lennonjohtaja on huomioinut kylmän lämpötilan vaatiman
            korjauksen, sisältää annettu selvitys sanonnan{" "}
            <code className="text-green-400 text-xs">
              LÄMPÖTILAKORJAUS TEHTY / TEMPERATURE CORRECTED BY ATC
            </code>
            .
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {airports.map((airport) => (
          <div
            key={airport.icao}
            className="bg-neutral-800 text-gray-200 p-6 rounded-[40px] corner-squircle shadow flex-1"
          >
            <div className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold">
                {airport.icao} {airport.name}
              </h2>
              <div className="flex flex-col items-end">
                <p className="text-sm text-gray-400">
                  {airport.elevationFt} ft
                </p>
                <p className="text-sm text-gray-400">{temps[airport.icao]}°C</p>
              </div>
            </div>

            {airport.corrections.map((corr, idx) => {
              const table = buildCTCTable(corr.feet, airport.elevationFt);

              return (
                <div key={idx} className="mt-4">
                  {/* Table */}
                  <table className="w-full text-sm mt-3 border border-slate-700">
                    <thead>
                      <tr className="text-center">
                        <th colSpan={3} className="bg-blue-950 p-2">
                          {corr.name} {corr.feet} ft
                        </th>
                      </tr>
                      <tr className="text-left">
                        <th className="text-right max-w-40 font-normal p-2 bg-blue-200 text-black border border-slate-700">
                          Lentopaikan lämpötila °C
                        </th>
                        <th className="text-center font-normal p-2 bg-blue-200 text-black border border-slate-700">
                          Alin selvityskorkeus <b>ft/QNH</b>
                        </th>
                        <th className="text-center font-normal p-2 bg-blue-200 text-black border border-slate-700">
                          Alin selvityskorkeus <b>m/QNH</b>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((row, rIdx) => {
                        let highlight = false;

                        if (!loadingTemps) {
                          const t = temps[airport.icao];

                          if (t === null) {
                            highlight = rIdx === 0;
                          } else {
                            const range = row.range.trim();

                            let low = null;
                            let high = null;

                            if (range.startsWith("…")) {
                              // Pattern: "… -5"
                              high = parseFloat(range.replace("…", "").trim());
                              low = 0; // upper bound (0°C)
                            } else {
                              // Pattern: "A … B"
                              const parts = range
                                .split("…")
                                .map((s) => s.trim());
                              if (parts.length === 2) {
                                low = parseFloat(parts[0]); // warmer temperature
                                high = parseFloat(parts[1]); // colder temperature
                              }
                            }

                            if (
                              low != null &&
                              high != null &&
                              !isNaN(low) &&
                              !isNaN(high)
                            ) {
                              if (t <= low && t >= high) {
                                highlight = true;
                              }
                            }
                          }
                        }

                        return (
                          <tr
                            key={rIdx}
                            className={`border border-slate-700 ${
                              highlight
                                ? "bg-green-300 text-black"
                                : "bg-white text-black"
                            }`}
                          >
                            <td className="px-2 py-1 text-right border border-slate-700">
                              {row.range}
                            </td>
                            <td className="px-2 py-1 text-center border border-slate-700">
                              {row.correctedFt}
                            </td>
                            <td className="px-2 py-1 text-center border border-slate-700">
                              {row.correctedM}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
