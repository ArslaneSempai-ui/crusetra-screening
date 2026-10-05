# Running on a machine without network

The tool needs the network for two things only, both explicit: installing the pinned
dependencies and downloading the public lists. Both can be done on a connected machine and
carried over.

1. On a connected machine: `npm ci --ignore-scripts`, then `npm run listes -- --fetch`, and,
   if you want the optional embedding tier, `npm run poids -- --fetch`.
2. Copy the whole folder, including `node_modules/`, `data/` and `listes-manifest.json`, to the
   machine without network (a USB drive, an internal transfer, whatever your policy allows).
3. On that machine, set `CRUSETRA_OFFLINE=1` in the environment. From then on, any command that
   would touch the network refuses and says so; screening, sealing and verifying never needed
   it. `CASCADE_OFFLINE=1`, the deprecated name of the same flag, still refuses exactly as
   before, so a machine set up under that name stays offline.
4. Run `npm run test` once: the suite runs with the network cut and proves the copy is whole.
5. Screen with `npm run cribler -- --names=<counterparties.csv>`. The report names the version
   and download date of every list it used, from the manifest you carried over.

To refresh the lists, repeat steps 1 and 2 for `data/listes/` and the manifest. The lists
change every week; the report's dates tell the reader how old they are.

To check a report later, on any machine: `npm run verify -- <report>` against the public key
`cle-publique.pem` that ships with the tool.
