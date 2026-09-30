/**
 * THE GLEIF HELD-OUT SET: real company-name pairs, labelled by the registry, never by a judge.
 *
 *   node src/gleif-paires.ts
 *
 * Every other pair set of this repository was written by an agent with invented names. This one
 * is drawn from the GLEIF golden copy (CC0 1.0): the legal name of an LEI record paired with
 * another name recorded on the SAME record (match), or the legal names of two DISTINCT LEIs that
 * share a distinctive word (different). Nobody decides whether two names "look alike": the
 * label is the register's.
 *
 * The two golden-copy files are pinned below by size and sha256. This script never downloads
 * anything (src/frontiere.test.ts would refuse it): fetch the two zips named below into
 * data/gleif/ (git-ignored), then run it. From the same two files it rewrites
 * verification/paires-gleif.json byte for byte: every random choice is a seeded hash of the
 * LEI and the stratum, never the order of a file or of a Map.
 *
 * The file is streamed (5 GB of CSV inside the zip): one pass over the Level 1 file, one over
 * the Level 2 file; only the candidate pairs and a seeded 25 % sample of the ISSUED legal names
 * stay in memory.
 *
 * It prints counts only. It never scores a pair: the single measurement is src/verdict-gleif.ts.
 */
import { createHash } from "node:crypto";
import { closeSync, createReadStream, existsSync, fstatSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { createInflateRaw } from "node:zlib";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";

/* ─────────────────────────── the pinned source ─────────────────────────── */

export const GLEIF_API = "https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest";
export const PUBLISH_DATE = "2026-09-30 08:00:00";
type Pinned = { url: string; file: string; bytes: number; sha256: string };
export const LEI2: Pinned = {
  url: "https://goldencopy.gleif.org/storage/golden-copy-files/2026/09/30/1282700/20260930-0800-gleif-goldencopy-lei2-golden-copy.csv.zip",
  file: "20260930-0800-gleif-goldencopy-lei2-golden-copy.csv.zip",
  bytes: 506285686,
  sha256: "62b7307663b412cd8d4b7226e4c6ccccb7b22066efea98a500ad2b205db2ce99",
};
export const RR: Pinned = {
  url: "https://goldencopy.gleif.org/storage/golden-copy-files/2026/09/30/1282745/20260930-0800-gleif-goldencopy-rr-golden-copy.csv.zip",
  file: "20260930-0800-gleif-goldencopy-rr-golden-copy.csv.zip",
  bytes: 24413344,
  sha256: "b348cdef56834609bbf98b1e37545ab90b2be55d8cc5b436dca7980846157110",
};
const DATA = new URL("../data/gleif/", import.meta.url);
const OUT = new URL("../verification/paires-gleif.json", import.meta.url);

/* ─────────────────────────── the selection rules ─────────────────────────── */

export const SEED = 20260930;
const POSITIVE_TARGET = 250;
const NEGATIVE_TARGETS: Record<NegStratum, number> = {
  "different-same-word-same-country": 334,
  "different-same-word-other-country": 333,
  "different-same-city-same-form": 333,
};
const CONTAINED_TARGET = 250;
/** No single country above this share of a stratum. */
const COUNTRY_CAP = 0.15;
/** The share of ISSUED, non-branch LEIs kept (by a seeded hash of the LEI) to draw negatives from. */
const SAMPLE_SHARE = 0.25;
/** A word in more than this share of the ISSUED legal names is not distinctive. */
const DF_MAX = 0.005;
/** A word is a legal-form word when it is in at least LEGAL_FORM_SHARE of the sampled names of
 *  one ISO 20275 legal form code (ELF) that has at least LEGAL_FORM_MIN_NAMES sampled names. */
const LEGAL_FORM_SHARE = 0.25;
const LEGAL_FORM_MIN_NAMES = 10;
const STOPWORDS = new Set([
  "the", "and", "for", "of", "a", "an", "in", "on", "at", "by", "to", "de", "del", "della", "delle", "dei", "degli",
  "di", "da", "do", "dos", "das", "des", "du", "la", "le", "les", "el", "los", "las", "et", "y", "e", "i", "und",
  "der", "die", "den", "dem", "van", "von", "vom", "zum", "zur", "het", "een", "en", "og", "och", "au", "aux",
  "sur", "per", "con", "al", "il", "lo", "gli", "im", "am", "ve", "ja",
]);
const PLACEHOLDERS = new Set([
  "", "na", "n a", "none", "null", "nil", "nan", "unknown", "not applicable", "not available", "tbd", "tba",
  "same", "same as above", "same as legal name", "idem", "xxx", "test", "no", "n d", "nd",
]);

type PosStratum = "previous-legal-name" | "trading-name" | "alternative-language-name" | "transliteration";
type NegStratum = "different-same-word-same-country" | "different-same-word-other-country" | "different-same-city-same-form";
const POS_STRATA: PosStratum[] = ["previous-legal-name", "trading-name", "alternative-language-name", "transliteration"];
const NEG_STRATA: NegStratum[] = ["different-same-word-same-country", "different-same-word-other-country", "different-same-city-same-form"];
const CONTAINED = "different-contained";
const OTHER_TYPES: Record<string, PosStratum> = {
  PREVIOUS_LEGAL_NAME: "previous-legal-name",
  TRADING_OR_OPERATING_NAME: "trading-name",
  ALTERNATIVE_LANGUAGE_LEGAL_NAME: "alternative-language-name",
};
const TRANSLITERATED_TYPES = new Set(["PREFERRED_ASCII_TRANSLITERATED_LEGAL_NAME", "AUTO_ASCII_TRANSLITERATED_LEGAL_NAME"]);
/** Level 2 relationships that put two LEIs in one group (a parent, a head office, an umbrella). */
const GROUP_RELATIONSHIPS = new Set(["IS_DIRECTLY_CONSOLIDATED_BY", "IS_ULTIMATELY_CONSOLIDATED_BY", "IS_INTERNATIONAL_BRANCH_OF", "IS_SUBFUND_OF"]);

/* ─────────────────────────── folding, hashing ─────────────────────────── */

/** NFKC, case, whitespace and punctuation folding: what "identical" means here. */
export function fold(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
}
const words = (folded: string): string[] => (folded === "" ? [] : folded.split(" "));

/** cyrb53 (public domain): a 53-bit string hash, the same on every platform. The seeded draw. */
export function hash53(s: string, seed = SEED): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Most letters outside the Latin script. */
export function nonLatin(s: string): boolean {
  const letters = (s.match(/\p{L}/gu) ?? []).length;
  const latin = (s.match(/\p{Script=Latin}/gu) ?? []).length;
  return letters - latin > latin;
}

/** Plainly not a name of the entity: empty, a placeholder, no letter at all (a pure number). */
export function notAName(name: string): boolean {
  const f = fold(name);
  return PLACEHOLDERS.has(f) || !/\p{L}/u.test(f);
}

/* ─────────────────────────── zip and CSV, streamed ─────────────────────────── */

/** The single entry of a zip file (zip64 aware): where its deflated bytes start and how many. */
function zipEntry(path: string): { start: number; compressed: number; size: number; method: number } {
  const fd = openSync(path, "r");
  try {
    const total = fstatSync(fd).size;
    const tailLen = Math.min(total, 65557 + 20);
    const tail = Buffer.alloc(tailLen);
    readSync(fd, tail, 0, tailLen, total - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error(`${path}: no end of central directory, not a zip file.`);
    let entries = tail.readUInt16LE(eocd + 10);
    let cdOffset = tail.readUInt32LE(eocd + 16);
    if (entries === 0xffff || cdOffset === 0xffffffff) {
      const loc = eocd - 20;
      if (loc < 0 || tail.readUInt32LE(loc) !== 0x07064b50) throw new Error(`${path}: zip64 locator missing.`);
      const z = Buffer.alloc(56);
      readSync(fd, z, 0, 56, Number(tail.readBigUInt64LE(loc + 8)));
      if (z.readUInt32LE(0) !== 0x06064b50) throw new Error(`${path}: zip64 end of central directory missing.`);
      entries = Number(z.readBigUInt64LE(32));
      cdOffset = Number(z.readBigUInt64LE(48));
    }
    if (entries !== 1) throw new Error(`${path}: ${entries} entries, expected the single CSV file.`);
    const h = Buffer.alloc(46);
    readSync(fd, h, 0, 46, cdOffset);
    if (h.readUInt32LE(0) !== 0x02014b50) throw new Error(`${path}: central directory header missing.`);
    const method = h.readUInt16LE(10);
    let compressed = h.readUInt32LE(20), size = h.readUInt32LE(24), local = h.readUInt32LE(42);
    const nameLen = h.readUInt16LE(28), extraLen = h.readUInt16LE(30);
    const extra = Buffer.alloc(extraLen);
    readSync(fd, extra, 0, extraLen, cdOffset + 46 + nameLen);
    for (let p = 0; p + 4 <= extraLen;) {
      const id = extra.readUInt16LE(p), len = extra.readUInt16LE(p + 2);
      if (id === 0x0001) {
        let q = p + 4;
        if (size === 0xffffffff) { size = Number(extra.readBigUInt64LE(q)); q += 8; }
        if (compressed === 0xffffffff) { compressed = Number(extra.readBigUInt64LE(q)); q += 8; }
        if (local === 0xffffffff) { local = Number(extra.readBigUInt64LE(q)); q += 8; }
      }
      p += 4 + len;
    }
    const l = Buffer.alloc(30);
    readSync(fd, l, 0, 30, local);
    if (l.readUInt32LE(0) !== 0x04034b50) throw new Error(`${path}: local file header missing.`);
    if (method !== 8 && method !== 0) throw new Error(`${path}: compression method ${method}, only deflate and stored are read.`);
    return { start: local + 30 + l.readUInt16LE(26) + l.readUInt16LE(28), compressed, size, method };
  } finally { closeSync(fd); }
}

/**
 * The records of the CSV inside a single-entry zip, streamed. `keep` names the columns whose
 * values are wanted (by header name); the others are skipped without being decoded. RFC 4180:
 * quoted fields, doubled quotes, line breaks inside quotes.
 *
 * The parse runs on BYTES, not on a decoded string: a quote, a comma or a line break is ASCII and
 * never a byte inside a UTF-8 sequence, and every kept value is decoded into a fresh string. A
 * value sliced out of a decoded chunk would keep the whole chunk alive in V8 (a sliced string
 * holds its parent), and keeping a quarter of the names kept the whole 5 GB file: measured, the
 * first version died at the 4 GB heap limit after 40 s.
 */
async function eachRecord(path: string, keep: readonly string[], onRecord: (f: Record<string, string>) => void): Promise<number> {
  const e = zipEntry(path);
  const raw = createReadStream(path, { start: e.start, end: e.start + e.compressed - 1, highWaterMark: 1 << 20 });
  const stream = e.method === 8 ? raw.pipe(createInflateRaw({ chunkSize: 1 << 20 })) : raw;
  let header: string[] | null = null;
  let wanted: boolean[] = [];
  let rest: Buffer = Buffer.alloc(0), inflated = 0, records = 0;

  const emit = (fields: string[]) => {
    if (header === null) {
      header = fields.map((f, i) => (i === 0 ? f.replace(/^\uFEFF/, "") : f));
      const missing = keep.filter((k) => !header!.includes(k));
      if (missing.length > 0) throw new Error(`${path}: columns missing from the header: ${missing.join(", ")}.`);
      wanted = header.map((n) => keep.includes(n));
      return;
    }
    if (fields.length !== header.length) throw new Error(`${path}: record ${records + 1} has ${fields.length} fields, the header ${header.length}.`);
    const r: Record<string, string> = {};
    for (let i = 0; i < fields.length; i++) if (wanted[i]) r[header[i]!] = fields[i]!;
    records++;
    onRecord(r);
  };

  /** Parses whole records out of `b`; returns the unparsed tail (an incomplete record). */
  const parse = (b: Buffer, final: boolean): Buffer => {
    const n = b.length;
    let pos = 0;
    while (pos < n) {
      const recordStart = pos;
      const fields: string[] = [];
      for (;;) {
        const want = header === null || wanted[fields.length] === true;
        let value = "";
        if (b[pos] === 34) {
          let j = pos + 1;
          for (;;) {
            const k = b.indexOf(34, j);
            if (k < 0 || (k + 1 >= n && !final)) return b.subarray(recordStart);
            if (b[k + 1] === 34) { if (want) value += b.toString("utf8", j, k + 1); j = k + 2; continue; }
            if (want) value += b.toString("utf8", j, k);
            pos = k + 1;
            break;
          }
        } else {
          let k = pos;
          while (k < n) { const c = b[k]; if (c === 44 || c === 10 || c === 13) break; k++; }
          if (k >= n && !final) return b.subarray(recordStart);
          if (want) value = b.toString("utf8", pos, k);
          pos = k;
        }
        fields.push(value);
        if (pos >= n) { if (!final) return b.subarray(recordStart); emit(fields); return Buffer.alloc(0); }
        const c = b[pos];
        if (c === 44) { pos++; if (pos >= n && !final) return b.subarray(recordStart); continue; }
        if (c === 13) { pos++; if (pos >= n && !final) return b.subarray(recordStart); if (b[pos] === 10) pos++; emit(fields); break; }
        if (c === 10) { pos++; emit(fields); break; }
        throw new Error(`${path}: malformed CSV near record ${records + 1}.`);
      }
    }
    return Buffer.alloc(0);
  };

  for await (const chunk of stream as AsyncIterable<Buffer>) {
    inflated += chunk.length;
    /* the tail is copied: a subarray would pin the previous chunk */
    rest = Buffer.from(parse(rest.length > 0 ? Buffer.concat([rest, chunk]) : chunk, false));
  }
  rest = parse(rest, true);
  if (rest.length !== 0) throw new Error(`${path}: the file ends inside a record.`);
  if (inflated !== e.size) throw new Error(`${path}: ${inflated} bytes inflated, the zip announces ${e.size}.`);
  return records;
}

async function sha256Of(path: string): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20 }) as AsyncIterable<Buffer>) h.update(chunk);
  return h.digest("hex");
}

async function checkPinned(p: Pinned): Promise<string> {
  const path = new URL(p.file, DATA).pathname;
  if (!existsSync(path)) {
    throw new Error(`${path} is missing.\n  Download it (GLEIF golden copy, CC0 1.0) from\n  ${p.url}\n  into data/gleif/, then run again. This script never downloads.`);
  }
  const bytes = statSync(path).size;
  const sha = await sha256Of(path);
  if (bytes !== p.bytes || sha !== p.sha256) {
    throw new Error(`${path}: ${bytes} bytes, sha256 ${sha}; pinned ${p.bytes} bytes, sha256 ${p.sha256}.\n  Another publish gives another set: pin it here on purpose, never by accident.`);
  }
  return path;
}

/* ─────────────────────────── the build ─────────────────────────── */

type Pair = { a: string; b: string; verdict: "match" | "different"; nature: string };
type Candidate = { h: number; lei: string; a: string; b: string; country: string };
const pairKey = (a: string, b: string) => [a, b].sort().join(" / ");
const countryOf = (jurisdiction: string, address: string) => (/^[A-Z]{2}(-|$)/.test(jurisdiction) ? jurisdiction.slice(0, 2) : address);

/** Names already used by the training sets and the verdict set, folded. */
function namesAlreadySeen(): Set<string> {
  const seen = new Set<string>();
  const src = new URL("./", import.meta.url);
  const files = readdirSync(src).filter((f) => /^paires-entites.*\.json$/.test(f)).map((f) => new URL(f, src));
  files.push(new URL("../verification/paires-entites-verdict.json", import.meta.url));
  for (const f of files) {
    for (const p of (JSON.parse(readFileSync(f, "utf8")) as { paires: { a: string; b: string }[] }).paires) { seen.add(fold(p.a)); seen.add(fold(p.b)); }
  }
  return seen;
}

/** The largest target T (at most `want`) that the per-country availability can fill under the cap. */
function feasibleTarget(available: Map<string, number>, want: number): number {
  for (let t = want; t > 0; t--) {
    const cap = Math.floor(COUNTRY_CAP * t);
    let fill = 0;
    for (const n of available.values()) fill += Math.min(n, cap);
    if (fill >= t) return t;
  }
  return 0;
}

type PoolCounts = { slots: number; notAName: number; identical: number; overlap: number; valid: number; records: number };

async function build(): Promise<{ json: string; report: string[] }> {
  const report: string[] = [];
  const lei2Path = await checkPinned(LEI2);
  const rrPath = await checkPinned(RR);
  const seen = namesAlreadySeen();

  /* Level 2: direct links (any relationship) and group keys (parent, head office, umbrella). */
  const links = new Set<string>();
  const parents = new Map<string, string[]>();
  const addParent = (child: string, parent: string) => { const l = parents.get(child); if (l) { if (!l.includes(parent)) l.push(parent); } else parents.set(child, [parent]); };
  const link = (x: string, y: string) => { if (x && y && x !== y) links.add(x < y ? `${x}|${y}` : `${y}|${x}`); };
  const rrRecords = await eachRecord(rrPath, ["Relationship.StartNode.NodeID", "Relationship.StartNode.NodeIDType", "Relationship.EndNode.NodeID", "Relationship.EndNode.NodeIDType", "Relationship.RelationshipType"], (r) => {
    if (r["Relationship.StartNode.NodeIDType"] !== "LEI" || r["Relationship.EndNode.NodeIDType"] !== "LEI") return;
    const child = r["Relationship.StartNode.NodeID"]!, parent = r["Relationship.EndNode.NodeID"]!;
    link(child, parent);
    if (GROUP_RELATIONSHIPS.has(r["Relationship.RelationshipType"]!)) addParent(child, parent);
  });
  report.push(`Level 2: ${rrRecords} relationship records, ${links.size} linked LEI pairs, ${parents.size} LEIs with a parent, head office or umbrella`);

  /* Level 1, one pass. */
  const OTHER = [1, 2, 3, 4, 5].map((i) => `Entity.OtherEntityNames.OtherEntityName.${i}`);
  const TRANS = [1, 2, 3, 4, 5].map((i) => `Entity.TransliteratedOtherEntityNames.TransliteratedOtherEntityName.${i}`);
  const SUCC = [1, 2, 3, 4, 5].map((i) => `Entity.SuccessorEntity.${i}.SuccessorLEI`);
  const keep = ["LEI", "Entity.LegalName", "Entity.LegalAddress.City", "Entity.LegalAddress.Country", "Entity.LegalJurisdiction",
    "Entity.EntityCategory", "Entity.LegalForm.EntityLegalFormCode", "Entity.AssociatedEntity.AssociatedLEI", "Registration.RegistrationStatus",
    ...OTHER, ...OTHER.map((c) => `${c}.type`), ...TRANS, ...TRANS.map((c) => `${c}.type`), ...SUCC];

  const pool = Object.fromEntries(POS_STRATA.map((s) => [s, { slots: 0, notAName: 0, identical: 0, overlap: 0, valid: 0, records: 0 }])) as Record<PosStratum, PoolCounts>;
  const kept = Object.fromEntries(POS_STRATA.map((s) => [s, new Map<string, Candidate[]>()])) as Record<PosStratum, Map<string, Candidate[]>>;
  const byCountry = Object.fromEntries(POS_STRATA.map((s) => [s, new Map<string, number>()])) as Record<PosStratum, Map<string, number>>;
  const keepBottom = (s: PosStratum, c: Candidate) => {
    const m = kept[s];
    const l = m.get(c.country);
    if (!l) { m.set(c.country, [c]); return; }
    l.push(c);
    if (l.length > 2 * POSITIVE_TARGET) { l.sort((x, y) => x.h - y.h || (x.lei < y.lei ? -1 : 1)); l.length = POSITIVE_TARGET; }
  };
  const statuses = new Map<string, number>();
  const df = new Map<string, number>();
  let issued = 0;
  const S = { lei: [] as string[], name: [] as string[], country: [] as string[], city: [] as string[], elf: [] as string[] };

  const lei2Records = await eachRecord(lei2Path, keep, (r) => {
    const status = r["Registration.RegistrationStatus"]!;
    statuses.set(status, (statuses.get(status) ?? 0) + 1);
    const lei = r["LEI"]!, legal = r["Entity.LegalName"]!.trim();
    const assoc = r["Entity.AssociatedEntity.AssociatedLEI"]!;
    if (assoc) { link(lei, assoc); addParent(lei, assoc); }
    for (const c of SUCC) link(lei, r[c]!);
    if (legal === "" || (status !== "ISSUED" && status !== "LAPSED")) return;
    const country = countryOf(r["Entity.LegalJurisdiction"]!, r["Entity.LegalAddress.Country"]!);
    const legalFolded = fold(legal);

    /* positives: this record's other names, one per stratum */
    const best = new Map<PosStratum, { h: number; b: string }>();
    const consider = (s: PosStratum, other: string) => {
      const p = pool[s];
      p.slots++;
      const b = other.trim();
      if (notAName(b) || b === lei) { p.notAName++; return; }
      const bf = fold(b);
      if (bf === legalFolded) { p.identical++; return; }
      if (seen.has(bf) || seen.has(legalFolded)) { p.overlap++; return; }
      p.valid++;
      const h = hash53(`${s}|${lei}|${b}`);
      const cur = best.get(s);
      if (!cur || h < cur.h) best.set(s, { h, b });
    };
    for (const c of OTHER) {
      const s = OTHER_TYPES[r[`${c}.type`]!];
      if (s) consider(s, r[c]!);
    }
    const transliterated = TRANS.filter((c) => TRANSLITERATED_TYPES.has(r[`${c}.type`]!));
    if (transliterated.length > 0 && nonLatin(legal)) for (const c of transliterated) consider("transliteration", r[c]!);
    for (const [s, { b }] of best) {
      pool[s].records++;
      byCountry[s].set(country, (byCountry[s].get(country) ?? 0) + 1);
      keepBottom(s, { h: hash53(`${s}|${lei}`), lei, a: legal, b, country });
    }

    /* negatives: document frequency over every ISSUED legal name, and the seeded sample */
    if (status !== "ISSUED") return;
    issued++;
    for (const w of new Set(words(legalFolded))) if (w.length >= 3 && !STOPWORDS.has(w) && /\p{L}/u.test(w)) df.set(w, (df.get(w) ?? 0) + 1);
    if (r["Entity.EntityCategory"] === "BRANCH") return;
    if (hash53(`sample|${lei}`) / 2 ** 53 >= SAMPLE_SHARE) return;
    S.lei.push(lei); S.name.push(legal); S.country.push(country);
    S.city.push(fold(r["Entity.LegalAddress.City"]!)); S.elf.push(r["Entity.LegalForm.EntityLegalFormCode"]!);
  });
  report.push(`Level 1: ${lei2Records} LEI records; registration status ${[...statuses.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  report.push(`Level 1 and 2 links together: ${links.size} linked LEI pairs`);

  const used = new Set<string>();
  const pairs: Pair[] = [];

  /* ── positives: the draw ── */
  const positiveCounts: string[] = [];
  for (const s of POS_STRATA) {
    const all = [...kept[s].values()].flat().sort((x, y) => x.h - y.h || (x.lei < y.lei ? -1 : 1));
    const target = feasibleTarget(byCountry[s], POSITIVE_TARGET);
    const cap = Math.floor(COUNTRY_CAP * target);
    const per = new Map<string, number>();
    let taken = 0, duplicates = 0;
    for (const c of all) {
      if (taken === target) break;
      if ((per.get(c.country) ?? 0) >= cap) continue;
      const k = pairKey(c.a, c.b);
      if (used.has(k)) { duplicates++; continue; }
      used.add(k);
      per.set(c.country, (per.get(c.country) ?? 0) + 1);
      pairs.push({ a: c.a, b: c.b, verdict: "match", nature: s });
      taken++;
    }
    const p = pool[s];
    const line = `${s}: ${taken} pairs (target ${POSITIVE_TARGET}${target < POSITIVE_TARGET ? `, the 15 % country cap allows ${target}` : ""}), ${per.size} countries, largest ${Math.max(...per.values())}; `
      + `pool ${p.slots} name slots on ISSUED or LAPSED records: ${p.notAName} not a name, ${p.identical} identical after folding, ${p.overlap} overlapping a training or verdict name, ${p.valid} valid on ${p.records} LEIs in ${byCountry[s].size} countries; ${duplicates} duplicate pairs skipped`;
    report.push(line);
    positiveCounts.push(`${s} ${taken} (from ${p.records} eligible LEIs; of ${p.slots} name slots, dropped ${p.identical} identical, ${p.notAName} not a name, ${p.overlap} overlapping)`);
  }

  /* ── negatives: legal-form words, distinctive words, the index ── */
  const N = S.lei.length;
  const namesPerForm = new Map<string, number>();
  const wordsPerForm = new Map<string, Map<string, number>>();
  const foldedS = S.name.map(fold);
  for (let i = 0; i < N; i++) {
    const elf = S.elf[i]!;
    if (elf === "" || elf === "8888" || elf === "9999") continue;
    namesPerForm.set(elf, (namesPerForm.get(elf) ?? 0) + 1);
    let m = wordsPerForm.get(elf);
    if (!m) { m = new Map(); wordsPerForm.set(elf, m); }
    for (const w of new Set(words(foldedS[i]!))) m.set(w, (m.get(w) ?? 0) + 1);
  }
  const legalForm = new Set<string>();
  const why = new Map<string, { elf: string; share: number; names: number }>();
  for (const [elf, m] of wordsPerForm) {
    const n = namesPerForm.get(elf)!;
    if (n < LEGAL_FORM_MIN_NAMES) continue;
    for (const [w, k] of m) {
      if (k < LEGAL_FORM_SHARE * n) continue;
      legalForm.add(w);
      const share = k / n, cur = why.get(w);
      if (!cur || share > cur.share || (share === cur.share && elf < cur.elf)) why.set(w, { elf, share, names: n });
    }
  }
  wordsPerForm.clear();
  /* the audit trail of the rule, written next to the golden copy in data/gleif/ and rebuilt with it */
  writeFileSync(new URL("legal-form-words.tsv", DATA), [...why.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([w, x]) => `${w}\t${x.elf}\t${x.share.toFixed(3)}\t${x.names}`).join("\n") + "\n");
  const dfMax = DF_MAX * issued;
  let frequent = 0;
  for (const k of df.values()) if (k > dfMax) frequent++;
  const distinctive = (w: string) => w.length >= 3 && /\p{L}/u.test(w) && !STOPWORDS.has(w) && !legalForm.has(w) && (df.get(w) ?? 0) <= dfMax;
  const tokens: string[][] = new Array(N);
  const core: Set<string>[] = new Array(N);
  const index = new Map<string, number[]>();
  for (let i = 0; i < N; i++) {
    const ws = [...new Set(words(foldedS[i]!))];
    core[i] = new Set(ws.filter((w) => !STOPWORDS.has(w) && !legalForm.has(w)));
    tokens[i] = ws.filter(distinctive);
    for (const w of tokens[i]!) { const l = index.get(w); if (l) l.push(i); else index.set(w, [i]); }
  }
  df.clear();
  report.push(`negatives drawn from ${N} ISSUED non-branch LEIs (seeded ${SAMPLE_SHARE * 100} % of ${issued} ISSUED); ${legalForm.size} legal-form words from ${[...namesPerForm.values()].filter((n) => n >= LEGAL_FORM_MIN_NAMES).length} ELF codes; ${frequent} words above ${DF_MAX * 100} % of the ISSUED names (${Math.round(dfMax)} names)`);

  const related = (i: number, j: number): boolean => {
    const x = S.lei[i]!, y = S.lei[j]!;
    if (links.has(x < y ? `${x}|${y}` : `${y}|${x}`)) return true;
    const px = parents.get(x), py = parents.get(y);
    return !!px && !!py && px.some((p) => py.includes(p));
  };
  const contained = (i: number, j: number): boolean => {
    const a = core[i]!, b = core[j]!;
    if (a.size === 0 || b.size === 0) return false;
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    for (const w of small) if (!large.has(w)) return false;
    return true;
  };

  type Draw = { taken: number; drawn: number; identical: number; contained: number; overlap: number; duplicates: number; related: number; countries: number; largest: number };
  const draw = (nature: string, target: number, eligible: (i: number, j: number) => boolean, containedStratum: boolean): Draw => {
    const order = Array.from({ length: N }, (_, i) => i)
      .map((i) => ({ i, h: hash53(`${nature}|${S.lei[i]}`) }))
      .sort((x, y) => x.h - y.h || (S.lei[x.i]! < S.lei[y.i]! ? -1 : 1));
    const cap = Math.floor(COUNTRY_CAP * target);
    const per = new Map<string, number>();
    const usedHere = new Set<number>();
    const d: Draw = { taken: 0, drawn: 0, identical: 0, contained: 0, overlap: 0, duplicates: 0, related: 0, countries: 0, largest: 0 };
    for (const { i } of order) {
      if (d.taken === target) break;
      if (usedHere.has(i) || (per.get(S.country[i]!) ?? 0) >= cap || tokens[i]!.length === 0) continue;
      const ws = [...tokens[i]!].sort((x, y) => hash53(`${nature}|${S.lei[i]}|${x}`) - hash53(`${nature}|${S.lei[i]}|${y}`) || (x < y ? -1 : 1));
      for (const w of ws) {
        let best = -1, bestH = Infinity;
        for (const j of index.get(w)!) {
          if (j === i || usedHere.has(j) || !eligible(i, j)) continue;
          if (related(i, j)) { d.related++; continue; }
          const h = hash53(`${nature}|${S.lei[i]}|${S.lei[j]}`);
          if (h < bestH || (h === bestH && S.lei[j]! < S.lei[best]!)) { best = j; bestH = h; }
        }
        if (best < 0) continue;
        d.drawn++;
        const a = S.name[i]!, b = S.name[best]!;
        if (foldedS[i] === foldedS[best]) { d.identical++; break; }
        if (!containedStratum && contained(i, best)) { d.contained++; break; }
        if (seen.has(foldedS[i]!) || seen.has(foldedS[best]!)) { d.overlap++; break; }
        const k = pairKey(a, b);
        if (used.has(k)) { d.duplicates++; break; }
        used.add(k); usedHere.add(i); usedHere.add(best);
        per.set(S.country[i]!, (per.get(S.country[i]!) ?? 0) + 1);
        pairs.push({ a, b, verdict: "different", nature });
        d.taken++;
        break;
      }
    }
    d.countries = per.size;
    d.largest = per.size ? Math.max(...per.values()) : 0;
    return d;
  };
  const describe = (nature: string, target: number, d: Draw) =>
    `${nature}: ${d.taken} pairs (target ${target}), ${d.countries} countries, largest ${d.largest}; ${d.drawn} pairs drawn: ${d.identical} identical after folding, ${d.contained} contained, ${d.overlap} overlapping a training or verdict name, ${d.duplicates} duplicates; ${d.related} candidate partners set aside as related (Level 1 or 2)`;

  const negativeCounts: string[] = [];
  let identicalTotal = 0, containedSeen = 0, drawnTotal = 0;
  const sameCity = (i: number, j: number) => S.country[i] === S.country[j] && S.city[i] !== "" && S.city[i] === S.city[j]
    && S.elf[i] !== "" && S.elf[i] !== "8888" && S.elf[i] !== "9999" && S.elf[i] === S.elf[j];
  const rules: Record<NegStratum, (i: number, j: number) => boolean> = {
    "different-same-word-same-country": (i, j) => S.country[i] === S.country[j],
    "different-same-word-other-country": (i, j) => S.country[i] !== S.country[j],
    "different-same-city-same-form": sameCity,
  };
  for (const s of NEG_STRATA) {
    const d = draw(s, NEGATIVE_TARGETS[s], rules[s], false);
    report.push(describe(s, NEGATIVE_TARGETS[s], d));
    negativeCounts.push(`${s} ${d.taken} (of ${d.drawn} drawn: ${d.identical} identical after folding, ${d.contained} contained, ${d.overlap} overlapping, ${d.duplicates} duplicates)`);
    identicalTotal += d.identical; containedSeen += d.contained; drawnTotal += d.drawn;
  }
  const dc = draw(CONTAINED, CONTAINED_TARGET, (i, j) => foldedS[i] !== foldedS[j] && contained(i, j), true);
  report.push(describe(CONTAINED, CONTAINED_TARGET, dc));

  const nMatch = pairs.filter((p) => p.verdict === "match").length;
  const nMain = pairs.filter((p) => p.verdict === "different" && p.nature !== CONTAINED).length;
  const provenance = [
    `GLEIF golden copy published ${PUBLISH_DATE} UTC, listed by ${GLEIF_API}.`,
    `Level 1 (LEI-CDF 3.1, full file, CSV): ${LEI2.url}, ${LEI2.bytes} bytes, sha256 ${LEI2.sha256}.`,
    `Level 2 relationships (RR 2.1, full file, CSV): ${RR.url}, ${RR.bytes} bytes, sha256 ${RR.sha256}.`,
    "GLEIF data is released under CC0 1.0 (no rights reserved, commercial use allowed).",
    `Built by node src/gleif-paires.ts, which checks both hashes and rewrites this file byte for byte; seed ${SEED} (every draw is a cyrb53 hash of the seed, the stratum and the LEI).`,
    "The labels come from the registry records, not from anyone judging whether two names match: a match pair is the legal name of one LEI record and another name recorded on that same record; a different pair is the legal names of two distinct LEIs.",
    `MATCH (${nMatch}): records with registration status ISSUED or LAPSED only (never DUPLICATE, ANNULLED, RETIRED, MERGED, TRANSFERRED, PENDING_*); one pair per LEI per stratum; at most ${POSITIVE_TARGET} per stratum; no country (legal jurisdiction, else legal address) above ${COUNTRY_CAP * 100} % of a stratum. Strata: previous-legal-name (OtherEntityName PREVIOUS_LEGAL_NAME), trading-name (TRADING_OR_OPERATING_NAME), alternative-language-name (ALTERNATIVE_LANGUAGE_LEGAL_NAME), transliteration (TransliteratedOtherEntityName PREFERRED_ or AUTO_ASCII_TRANSLITERATED_LEGAL_NAME, kept only where most letters of the legal name are outside the Latin script). Dropped before the draw: other names that are empty, a placeholder, carry no letter or repeat the LEI; pairs identical after NFKC, case, whitespace and punctuation folding; pairs with a name that, folded the same way, is in a training set (src/paires-entites*.json) or in verification/paires-entites-verdict.json.`,
    `Counts: ${positiveCounts.join("; ")}.`,
    `DIFFERENT (${nMain}, plus the contained stratum): two distinct ISSUED, non-branch LEIs from a seeded ${SAMPLE_SHARE * 100} % sample of the ${issued} ISSUED records, whose legal names share a distinctive word: at least 3 characters, a letter, not a stopword, not a legal-form word (in at least ${LEGAL_FORM_SHARE * 100} % of the sampled names of one ISO 20275 ELF code with at least ${LEGAL_FORM_MIN_NAMES} of them: ${legalForm.size} words, mostly legal forms and their fragments, plus generic entity words such as bank, fund, trust or holding and a few place names; the rebuild writes them to data/gleif/legal-form-words.tsv), in at most ${DF_MAX * 100} % of the ISSUED legal names. Each drawn LEI appears once per stratum, and no country above ${COUNTRY_CAP * 100} % of a stratum. Strata: same shared word and same country; same shared word, different country; same legal-address city, same country and same ELF legal form code (not 8888 or 9999), with a shared word. Set aside: pairs linked in the Level 2 file (any relationship, or a common direct or ultimate parent, head office or umbrella fund) or through the Level 1 associated or successor entity; pairs identical after folding (${identicalTotal} of ${drawnTotal} drawn: different entities with the same name cannot be separated by a name matcher); pairs where every word of one name, legal-form words and stopwords set aside, is in the other (${containedSeen} of ${drawnTotal} drawn).`,
    `Counts: ${negativeCounts.join("; ")}.`,
    `CONTAINED (${dc.taken}, nature ${CONTAINED}): the contained pairs, drawn on their own from the same sample: two distinct ISSUED LEIs, any country, sharing a distinctive word, not identical after folding, not related, and every word of one name (legal-form words and stopwords set aside) in the other. Screening practice may want them to alert: they are reported as their own stratum and never counted in the false-alert rate of the other negatives.`,
    "No one looked at the matcher's result on any pair before the single measurement (node src/verdict-gleif.ts).",
  ].join(" ");
  const head = {
    quoi: "company name pairs from the GLEIF register: two names recorded for the same LEI (match), or the legal names of two distinct LEIs sharing a distinctive word (different)",
    provenance,
    avertissement: "judge once, aggregates only: reading the pairs or their scores makes it a training set; the different-contained stratum is reported on its own, never inside the negatives' false-alert rate",
  };
  const J = JSON.stringify;
  const json = `{"quoi": ${J(head.quoi)}, "provenance": ${J(head.provenance)}, "avertissement": ${J(head.avertissement)}, "paires": [\n`
    + pairs.map((p) => `{"a": ${J(p.a)}, "b": ${J(p.b)}, "verdict": ${J(p.verdict)}, "nature": ${J(p.nature)}}`).join(",\n")
    + "\n]}\n";
  return { json, report };
}

async function main(): Promise<void> {
  refuserDrapeauxInconnus([]);
  const t0 = Date.now();
  const { json, report } = await build();
  writeFileSync(OUT, json);
  for (const l of report) console.log(l);
  console.log(`wrote verification/paires-gleif.json, sha256 ${createHash("sha256").update(json).digest("hex")}, in ${Math.round((Date.now() - t0) / 1000)} s`);
}

if (isMain(import.meta)) await main();
