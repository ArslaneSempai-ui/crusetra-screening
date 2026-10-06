# Renamed vessels: a measurement on HullCipher's data (5 October 2026)

HullCipher (hullcipher.com) watches the identities that listed vessels broadcast at sea and records where a broadcast
differs from the listing. We screened its record of renamed vessels with Crusetra Screening, once, under a protocol
written before the file was downloaded. This page gives counts only. No row, vessel name or IMO number from the file is
published here, and HullCipher agreed to the publication of these counts.

data: HullCipher

## What was measured

- The file: HullCipher's full history of identity discrepancies, exported on 5 October 2026 at 07:03 UTC (1,494 rows,
  sha256 404e943c94d4d1374f9131789420c71ec5655d2a8fd5a9e2223bb03c61caa24b). Its first sightings go back to
  26 June 2026, and a completeness check written before the download confirmed it holds the whole history, not only the
  last 24 hours.
- The rows kept: the 863 name changes. A repeat of the same IMO with the same broadcast name was counted once, which
  left 652 rows on 595 distinct IMOs. When the broadcast name was empty (186 rows), the observed value was screened
  instead, as decided before any row was read.
- The matcher: Crusetra Screening at commit a4c53bf, the method frozen for the fourth GLEIF verdict (85 files, every
  hash unchanged), with its own thresholds: strong 0.81, possible 0.80.
- The lists: seven public sources downloaded on 26 September and 4 October 2026: OFAC SDN (19,391 entries), the OFAC
  consolidated non-SDN lists (481), the US Consolidated Screening List (6,269), the UN Security Council list (1,011),
  the EU financial sanctions list (6,241), the UK Sanctions List (6,370) and the vessels the EU designates in Annex XLII
  of Regulation 833/2014 (672).
- Intervals are 95 % Wilson intervals.

## What we found

1. Coverage: 593 of the 595 IMOs are on at least one of the seven sources, 99.7 % [98.8-99.9].
2. The broadcast name screened together with its IMO: the listed vessel comes back at the strong level on 649 of the
   649 covered rows, 100 % [99.4-100.0], and on 649 of all 652 rows, 99.5 % [98.7-99.8].
3. The broadcast name screened alone, without the IMO: the top candidate is the listed vessel on 88 of the 649 covered
   rows at the strong level, 13.6 % [11.1-16.4], and on 92 at the possible level, 14.2 % [11.7-17.1].
4. False alerts were not measured: the file holds listed vessels only, so it has no negatives.

## What it means

A renamed vessel is found by its IMO number. By its new name alone, the listed vessel comes first for about one row
in seven. The sealed record and the spreadsheet Crusetra Screening writes flag every vessel row sent without an IMO
(column vessel_without_imo), so a reviewer knows that row was checked by name only.

Two limits. Rows that a crew typed wrongly stay in the count, so the names-only rate mixes real renames with typing
slips. And these are HullCipher's observations of broadcasts, measured against seven lists; the tool now reads ten.
