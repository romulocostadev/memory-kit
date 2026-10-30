# Knowledge types, folders and page formats

## First, the filter

In three months, would someone want to know this? If not, do not record it.

## The seven questions

Ask them in order. The first "yes" decides the type.

1. Does someone need to do something? → **Action**. Not a memory: tell the person to put it in their task tool (Ações, Jira). Do not write it.
2. Was it a choice between paths, with a reason? → **Decision**.
3. Is it an "always" or "never" for acting? → **Rule**.
4. Did it bite, or will it bite? → **Gotcha**.
5. Is it a repeatable step-by-step? → **Procedure**.
6. Is it true about the world, and will someone look it up again? → **Fact**. When it changes over time, it gets an expiry date.
7. None of the above → it stays only in the summary of the meeting or document.

## Type → tag → curated folder

| Type | Tag | Curated folder |
|---|---|---|
| decision | `type-decision` | `decisions/` |
| rule | `type-rule` | `_rules/` |
| gotcha | `type-gotcha` | `gotchas/` |
| procedure | `type-procedure` | `procedures/` |
| fact | `type-fact` | `concepts/` |
| meeting | `type-meeting` | `meetings/` |
| doc | `type-doc` | `docs/` |

## Templates (the body after the header block)

**Decision**
```
## Decision
<what was decided>

## Why
<the reason>

## Alternatives
- <alternative>: <why not>

## When and who
<date>, <people involved>
```

**Rule**
```
## Rule
<always / never ...>

## Why
<the reason>
```

**Gotcha**
```
## Symptom
## Cause
## Mitigation
```

**Procedure**
```
## When to use
## Steps
1. ...
```

**Fact**
```
## Fact
<the statement>

## Valid until
<date, or "no expiry">
```

**Meeting** (summary only; decisions, rules and facts from it become their own drafts)
```
## Summary
## Who
## What came out
- <links to the drafts made from it>
```

**Doc** (summary of an ingested source)
```
## Summary
## Key points
## Source
<path of the source page>
```

## Draft pages

- Path: `drafts/<YYYY-MM-DD>-<type>-<slug>.md`, in a project from **Writes**.
- `kind`: `draft`.
- `tags`: `draft`, `status-pending`, `type-<type>`.
- Body:

```
# <title>

Target unit: `<project>`
Sources: <source page paths, or "conversation on <date>">
Quotes:
> <the exact lines that back it>
Proposed by: <User from the reference>
Proposed at: <YYYY-MM-DD>

<the type template, filled>
```

- The target unit may be a project the person only **reads**: the draft still sits in a project they write.
- A proposer may rewrite their own draft while it is `status-pending`, or retire it by rewriting it with the tag `status-withdrawn` instead of `status-pending`. A draft that is approved or discarded is never changed by its proposer.

## Source pages

- Path: `sources/<YYYY-MM-DD>-<slug>.md`, in a project from **Writes**.
- `kind`: `source`; `tags`: `source`; write with `create_only: true`.
- Body:

```
# <document title>

Origin: <original file name>; <link, if it has one>
Ingested by: <User from the reference>
Ingested at: <YYYY-MM-DD>
SHA-256: <hash of the original file, or "unknown">
Unit: `<project>`

<the document converted to Markdown>
```

- Large documents: when the converted text is longer than about 4000 tokens (roughly 16,000 characters), split it by section into `sources/<YYYY-MM-DD>-<slug>/<NN>-<section-slug>.md` (each with the same header block plus `Part: <NN> of <total>`), and make `sources/<YYYY-MM-DD>-<slug>.md` an index page listing the parts. Search only embeds the start of each page, so small parts keep every section findable.
