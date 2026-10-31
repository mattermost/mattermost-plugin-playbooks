#!/usr/bin/env python3
# Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""Sort top-level type declarations in graphql-codegen-go output.

graphql-codegen-go@v1.2.1 ranges over a Go map when emitting enums, so declaration
order is nondeterministic across runs. Sorting by type name keeps `make graphql`
diffs stable for CI.
"""

from __future__ import annotations

import re
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <models.go>", file=sys.stderr)
        return 2

    path = sys.argv[1]
    with open(path, encoding="utf-8") as fh:
        text = fh.read()

    match = re.match(r"(.*?^package \w+\n)", text, re.M | re.S)
    if not match:
        print(f"{path}: missing package clause", file=sys.stderr)
        return 1

    header = match.group(1)
    body = text[match.end() :]
    parts = re.split(r"(?m)(?=^type )", body)
    leading, blocks = parts[0], parts[1:]

    def type_name(block: str) -> str:
        return block.split("\n", 1)[0].split()[1]

    blocks.sort(key=type_name)
    out = header + leading + "".join(blocks)
    if not out.endswith("\n"):
        out += "\n"

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
