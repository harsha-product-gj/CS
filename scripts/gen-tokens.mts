// Generates src/app/tokens.css from design/intellsys-tokens.json (Intellsys design system).
// Usage: npm run tokens
import fs from "node:fs";

const t = JSON.parse(fs.readFileSync("design/intellsys-tokens.json", "utf8"));
const light: string[] = [];
const dark: string[] = [];
const theme: string[] = [];
const val = (v: unknown, theme: "light" | "dark") =>
  typeof v === "string" ? (theme === "light" ? v : null) : (v as Record<string, string>)[theme] ?? null;

for (const c of t.color.tokens) {
  light.push(`  --${c.name}: ${val(c.value, "light")};`);
  const d = val(c.value, "dark");
  if (d) dark.push(`  --${c.name}: ${d};`);
  theme.push(`  --color-${c.name}: var(--${c.name});`);
}
for (const fam of ["spacing", "radius", "shadow", "borderWidth", "opacity", "size"]) {
  for (const x of t[fam]?.tokens ?? []) {
    light.push(`  --${x.name}: ${val(x.value, "light")};`);
    const d = typeof x.value === "object" ? val(x.value, "dark") : null;
    if (d) dark.push(`  --${x.name}: ${d};`);
  }
}
for (const x of t.radius.tokens) theme.push(`  --radius-${x.name.replace("ds-radius-", "ds-")}: var(--${x.name});`);
for (const x of t.shadow.tokens) theme.push(`  --shadow-${x.name.replace("ds-shadow-", "ds-")}: var(--${x.name});`);

const css = `/* Intellsys design system — generated from design/intellsys-tokens.json by scripts/gen-tokens.mts. Do not edit. */
:root {
${light.join("\n")}
}

[data-color-mode="dark"] {
${dark.join("\n")}
}

@theme inline {
${theme.join("\n")}
}
`;
fs.writeFileSync("src/app/tokens.css", css);
console.log(`tokens.css: ${t.color.tokens.length} colours`);
