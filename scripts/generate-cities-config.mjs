// One-off data-generation script (not a runtime dependency): regenerates
// `src/constants/citiesConfig.ts` from INSEE's official commune dataset via
// the French government's open geo API. Re-run manually if the population
// threshold or dataset needs to change — see SPECS.md Section 4.
//
// Usage: node scripts/generate-cities-config.mjs

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const POPULATION_THRESHOLD = 5000;
const SOURCE_URL =
  "https://geo.api.gouv.fr/communes?fields=nom,code,codeDepartement,population&format=json";
const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "constants",
  "citiesConfig.ts",
);

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/'/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch commune dataset: HTTP ${res.status}`);
  }
  const communes = await res.json();

  const eligible = communes.filter(
    (c) => typeof c.population === "number" && c.population >= POPULATION_THRESHOLD,
  );

  const bySlug = new Map();
  for (const c of eligible) {
    const slug = slugify(c.nom);
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(c);
  }

  const cities = [];
  for (const [slug, group] of bySlug) {
    if (group.length === 1) {
      cities.push({ key: slug, label: group[0].nom });
    } else {
      // Disambiguate same-named communes by suffixing the department code.
      for (const c of group) {
        cities.push({ key: `${slug}-${c.codeDepartement.toLowerCase()}`, label: c.nom });
      }
    }
  }

  cities.sort((a, b) =>
    slugify(a.label).localeCompare(slugify(b.label), "fr", { sensitivity: "base" }),
  );

  const keys = new Set();
  for (const c of cities) {
    if (keys.has(c.key)) throw new Error(`Duplicate key generated: ${c.key}`);
    keys.add(c.key);
  }

  const lines = cities.map((c) => `  { key: "${c.key}", label: ${JSON.stringify(c.label)} },`);

  const output = `export interface CitySetting {
  key: string;
  label: string;
}

/**
 * Core extensibility list for IRL city scoping — mirrors \`GAMES_CONFIG\`
 * (see SPECS.md Section 4): supporting a new city only requires appending
 * an entry here, no schema or component changes needed. \`key\` is a
 * stable, filter-safe slug persisted on \`profiles.city\` / \`pods.city\`
 * (never rendered directly); \`label\` is the display name shown in the UI.
 *
 * Generated from INSEE's official commune dataset (communes with
 * population >= ${POPULATION_THRESHOLD}) via \`scripts/generate-cities-config.mjs\`.
 * Re-run that script to regenerate this list.
 */
export const CITIES_CONFIG: CitySetting[] = [
${lines.join("\n")}
];

export const CITY_MAP: Record<string, CitySetting> = Object.fromEntries(
  CITIES_CONFIG.map((city) => [city.key, city]),
);
`;

  await writeFile(OUTPUT_PATH, output, "utf8");
  console.log(`Wrote ${cities.length} cities to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
