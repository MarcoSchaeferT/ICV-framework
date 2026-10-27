import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postcss from "postcss";
import type { JSX } from "react";

type ThemeColor = {
  name: string;
  value: string;
};

/** Read the color tokens from the CSS file that Tailwind actually compiles. */
async function getThemeColors(): Promise<ThemeColor[]> {
  const stylesheet = join(process.cwd(), "src/app/globals.css");
  const css = await readFile(stylesheet, "utf8");
  const colors: ThemeColor[] = [];

  postcss.parse(css, { from: stylesheet }).walkAtRules("theme", (rule) => {
    rule.walkDecls(/^--color-/, (declaration) => {
      colors.push({ name: declaration.prop, value: declaration.value });
    });
  });

  if (colors.length === 0) {
    throw new Error(`No theme color tokens found in ${stylesheet}`);
  }

  return colors;
}

/** Shows the application palette as defined in the Tailwind v4 stylesheet. */
export default async function ThemeColorsPage(): Promise<JSX.Element> {
  const colors = await getThemeColors();
  const groups = new Map<string, ThemeColor[]>();

  for (const color of colors) {
    const group = color.name.slice("--color-".length).split("-")[0];
    const entries = groups.get(group) ?? [];
    entries.push(color);
    groups.set(group, entries);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10 text-slate-900 dark:text-slate-100">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold">Theme colors</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Color tokens defined in <code>src/app/globals.css</code>.
        </p>
      </header>

      <div className="space-y-10">
        {Array.from(groups, ([group, entries]) => (
          <section key={group} aria-labelledby={`colors-${group}`}>
            <h2 id={`colors-${group}`} className="mb-4 text-xl font-semibold capitalize">
              {group}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {entries.map(({ name, value }) => (
                <li
                  key={name}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div
                    aria-hidden="true"
                    className="h-20 border-b border-slate-200 dark:border-slate-700"
                    style={{ backgroundColor: value }}
                  />
                  <div className="space-y-1 p-3">
                    <code className="block break-all text-xs font-semibold">{name}</code>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{value}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
