"""The bridge between crusetra-screening's audit and nomenklatura's logic-v2 matcher.

  python scripts/logic_v2.py <schema>     pairs on stdin, scores on stdout

stdin : one JSON object per line, {"a": "<screened name>", "b": "<listed name>"}.
stdout: a first line {"nomenklatura": "<version>", "schema": "<schema>"}, then one score per pair,
        in order, one per line.

It installs nothing, downloads nothing and opens no socket: when nomenklatura is not importable it
exits with code 3 and one line on stderr, and the audit reports the tier as absent. The two names
are the only properties of the two entities, so this is logic-v2's name matching, not a screening
with dates of birth, countries or identifiers.
"""
import json
import sys


def main() -> int:
    schema = sys.argv[1] if len(sys.argv) > 1 else "LegalEntity"
    try:
        from importlib.metadata import version

        from followthemoney import EntityProxy, model
        from nomenklatura.matching import LogicV2
    except Exception as exc:  # absent or broken install: say so, score nothing
        print(f"nomenklatura is not importable by this Python: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 3
    if model.get(schema) is None:
        print(f"unknown FollowTheMoney schema: {schema}", file=sys.stderr)
        return 2
    print(json.dumps({"nomenklatura": version("nomenklatura"), "schema": schema}), flush=True)
    for n, line in enumerate(sys.stdin):
        if not line.strip():
            continue
        pair = json.loads(line)
        query = EntityProxy.from_dict({"id": f"q{n}", "schema": schema, "properties": {"name": [pair["a"]]}})
        result = EntityProxy.from_dict({"id": f"r{n}", "schema": schema, "properties": {"name": [pair["b"]]}})
        score = LogicV2.compare(query, result, LogicV2.default_config()).score
        print(repr(max(0.0, min(1.0, float(score)))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
