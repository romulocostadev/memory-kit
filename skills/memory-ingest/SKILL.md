---
name: memory-ingest
description: Save a document (contract, proposal, e-mail, spec, meeting notes, technical doc) into the company memory. Converts it to Markdown, files it in the right unit as a source, and proposes a summary plus the decisions, rules and facts found in it as drafts for approval. Use when the person asks to save, store, catalogue or ingest a document or attachment ("guarda esse contrato", "cataloga esse documento").
---

# Ingest a document into the company memory

Answer the person in the person's language. Never call `memory_delete_page`.

Read `reference.md` (next to this file) and load the person's reference first. Read `types.md` for the page formats.

## Steps

1. **Get the text.**
   - In Claude Code, convert the file locally: `uvx markitdown "<file>"` (fall back to reading it yourself if that tool is missing). Compute its SHA-256 (`certutil -hashfile "<file>" SHA256` on Windows, `shasum -a 256 "<file>"` on macOS).
   - In Claude Desktop, read the attached file and transcribe it faithfully to Markdown (headings, lists, tables). The SHA-256 is "unknown".
   - Never summarize at this step: the source keeps the full text.
2. **Pick the unit.** Choose among the projects under **Writes** in the reference, using the unit names and the document's content.
   - If the person writes exactly one project, use it.
   - Otherwise propose the most likely one and ask the person to confirm it, in one short question. Role `all` and `approver` always ask.
3. **Check for a duplicate.** Search that project with `memory_query` (`path_prefix: "sources/"`, the document title as the query). If a source with the same SHA-256, or the same title and origin, exists, stop and tell the person where it is.
4. **Write the source page** as `types.md` says (`sources/…`, `kind: source`, tag `source`, `create_only: true`). Split it when it is large.
5. **Draft the knowledge.**
   - One `doc` draft: the summary, key points and the source path.
   - One draft per item the seven questions find (decision, rule, gotcha, procedure, fact), each with the exact quoted lines from the document. Skip actions (tell the person instead) and anything that fails the three-months filter.
   - Each draft's `Target unit` is usually the source's unit; use another project from the reference when the item clearly belongs there.
6. **Report** in a few lines: where the source went, the list of drafts with their types, and that they wait for approval before entering the memory.
