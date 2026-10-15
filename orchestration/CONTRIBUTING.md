# Contributing to the orchestration package

## Line endings and the fixture/report comparison rule

This repository normalizes **all text files to LF** (see the root
`.gitattributes` and `.editorconfig`). On Windows, `core.autocrlf=true`
checks files out as CRLF in your working tree, but git still **stores LF** in
commits. CI checks out with LF on Linux.

Because of that split, **never compare a committed fixture or generated report
against the raw bytes in your working tree** — they will differ by CRLF even
when the content is identical. Normalize to the repository representation (LF)
before diffing. From a shell:

```sh
# Read the committed blob, and produce your local report with the same pinned
# --now, then compare after stripping any CR:
git show HEAD:orchestration/fixtures/policy-report-example.json > /tmp/committed.json
diff <(sed 's/\r$//' /tmp/committed.json) <(sed 's/\r$//' /tmp/local.json)
```

The CI **EOL & final-newline guard** checks only files changed in your PR, so it
will not flag legacy files, but every file you add or modify must use LF and end
with a final newline. Most editors honor `.editorconfig` automatically;
otherwise configure your editor, run `dos2unix`, or add the final newline by
hand.

## Reproducible policy reports

`runPolicyCheck` takes an injected clock and emits explicit source ids, so a
report is byte-for-byte reproducible. When regenerating
`fixtures/policy-report-example.json`, pin the same `--now` value and compare
using the LF-normalized rule above.
