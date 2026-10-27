/** Check the hand-written Fumadocs pages without changing generated TypeDoc output. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('content/docs');
const generatedDirs = new Set([
  path.join(root, 'developer-guide', 'api', 'typescript'),
  path.join(root, 'developer-guide', 'api', 'python'),
]);
const errors = [];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (generatedDirs.has(file)) return [];
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function relative(file) {
  return path.relative(process.cwd(), file).replaceAll(path.sep, '/');
}

function isPage(file) {
  return existsSync(file) && statSync(file).isFile();
}

function resolvePage(source, destination) {
  const target = path.resolve(path.dirname(source), destination);
  if (!target.startsWith(`${root}${path.sep}`) && target !== root) return null;
  const candidates = destination.endsWith('.mdx')
    ? [target]
    : [
        `${target}.mdx`,
        path.join(target, 'index.mdx'),
      ];
  return candidates.find(isPage) ?? null;
}

function proseOnly(content) {
  let fenced = false;
  return content.split(/\r?\n/).map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return '';
    }
    return fenced ? '' : line;
  }).join('\n');
}

function anchorsFor(file) {
  const prose = proseOnly(readFileSync(file, 'utf8'));
  const seen = new Map();
  return new Set([...prose.matchAll(/^#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gm)].map((match) => {
    const slug = match[1]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>|[`*_~]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-');
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    return count ? `${slug}-${count}` : slug;
  }));
}

const pages = walk(root).filter((file) => file.endsWith('.mdx'));
for (const file of pages) {
  const content = readFileSync(file, 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter || !/^title:\s*\S+/m.test(frontmatter) || !/^description:\s*\S+/m.test(frontmatter)) {
    errors.push(`${relative(file)}: frontmatter needs a title and description`);
  }

  const prose = proseOnly(content);
  const destinations = [
    ...[...prose.matchAll(/(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((match) => match[1]),
    ...[...prose.matchAll(/\bhref=["']([^"']+)["']/g)].map((match) => match[1]),
  ];
  for (const destination of destinations) {
    if (!destination.startsWith('./') && !destination.startsWith('../') && !destination.startsWith('#')) continue;
    const pathname = destination.split(/[?#]/, 1)[0];
    const target = pathname ? resolvePage(file, decodeURIComponent(pathname)) : file;
    if (!target) {
      errors.push(`${relative(file)}: missing relative page ${destination}`);
      continue;
    }
    const anchor = destination.match(/#([^?]*)/)?.[1];
    const isGeneratedTarget = [...generatedDirs].some((dir) => target.startsWith(`${dir}${path.sep}`));
    if (anchor && !isGeneratedTarget && !anchorsFor(target).has(decodeURIComponent(anchor))) {
      errors.push(`${relative(file)}: missing anchor ${destination}`);
    }
  }
}

for (const meta of walk(root).filter((file) => /(?:^|[\\/])meta(?:\.de)?\.json$/.test(file))) {
  let data;
  try {
    data = JSON.parse(readFileSync(meta, 'utf8'));
  } catch (error) {
    errors.push(`${relative(meta)}: invalid JSON (${error.message})`);
    continue;
  }
  if (!Array.isArray(data.pages)) continue;
  const seen = new Set();
  for (const slug of data.pages) {
    if (typeof slug !== 'string' || !slug || seen.has(slug)) {
      errors.push(`${relative(meta)}: invalid or repeated page entry ${JSON.stringify(slug)}`);
      continue;
    }
    seen.add(slug);
    const target = path.join(path.dirname(meta), slug);
    if (!isPage(`${target}.mdx`) && !existsSync(target)) {
      errors.push(`${relative(meta)}: missing page entry ${slug}`);
    }
  }
}

for (const file of walk(root)) {
  if (/(?:\.de\.mdx|[\\/]meta\.de\.json)$/.test(file)) {
    errors.push(`${relative(file)}: the documentation portal is English-only`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`Checked ${pages.length} hand-written MDX pages and local navigation.`);
}
