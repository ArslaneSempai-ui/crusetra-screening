# Vendor security questionnaire, pre-filled

Answers to the questions a compliance or procurement team usually asks. Every "no" below is
a fact about how the tool is built, held by the tests named in the README, not a promise.
Where we hold no certification, we say so.

| Question | Answer |
|---|---|
| Where is the service hosted? | Nowhere. The tool runs on your machine. There is no server side. |
| What data do you collect? | None. The tool never sends anything; see `doc/DATA-FLOW.md`. |
| What data do you retain? | None. Your files and reports stay on your machine. If you send us a file to screen as a service, we keep no copy after delivery. |
| Sub-processors? | None. |
| Third-party services called at runtime? | None. The only remote hosts are the public list servers and the package registry, on explicit download commands. |
| Encryption in transit? | HTTPS for the downloads. Nothing else transits. |
| Encryption at rest? | Your operating system's. The tool adds no storage of its own. |
| Authentication, accounts, SSO? | Not applicable. There are no accounts. |
| Logging and monitoring? | Local only, on your machine, in the report files. |
| Telemetry, analytics, crash reporting? | No. |
| Automatic updates? | No. Versions are pinned by the lockfile; updating is a deliberate `git pull` and `npm ci`. |
| Remote access by the vendor? | Never. There is no mechanism for it. |
| Personal data? | The tool compares company and vessel names against public sanctions lists. It needs no dates of birth, addresses or identifiers, and the report contains only what your file and the public lists contain. |
| Data location? | Your machine, your country. |
| Deletion? | Delete the folder. |
| Code integrity? | Lockfile with pinned versions, `npm ci --ignore-scripts`, a software bill of materials (`sbom.json`), a licence inventory (`LICENCES.md`), and the whole test suite run on macOS, Linux and Windows at every push. |
| Report integrity? | Every report is sealed with a content hash and signed; anyone verifies it with `npm run verify` against the public key `cle-publique.pem`, without asking us. |
| Vulnerability management? | Dependencies pinned and inventoried; no dependency install script runs; the network boundary is a test. Report an issue to contact@crusetra.com. |
| Business continuity? | The source is readable and the tool runs offline; nothing depends on our being reachable. |
| Certifications (SOC 2, ISO 27001)? | None. The controls above are inspectable instead. |
| Windows? | The suite runs on Windows at every push. No client has yet run the tool on a Windows workstation, and we do not claim it. |
| Legal advice? | No. A candidate in a report is a name for your compliance officer to read, never a match established. |
