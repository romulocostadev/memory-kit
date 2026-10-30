---
name: memory-review
description: For the approver only. Review the pending drafts proposed across every unit of the company memory and approve, edit or discard each one; approving writes the curated page. Use when the approver asks to review, approve or go through the pending drafts ("revisar rascunhos", "o que tem pra aprovar").
---

# Review pending drafts (approver)

Answer the person in the person's language. Never call `memory_delete_page`.

Load the approver's reference from `~/.claude/memory-kit/approver.md` (on Windows: `%USERPROFILE%\.claude\memory-kit\approver.md`), as `reference.md` (next to this file) explains. If it is missing or its `Role:` is not `approver`, stop and say this skill is only for the approver. Use only the tools of the MCP server named `<Workspace>-approver` (for example `acme-approver`): the person's own server cannot write curated pages. Read `types.md` for the formats.

## Steps

1. **List the queue.** For each project under **Writes**, call `memory_query` with that project (and the workspace), `tag: "status-pending"`, `path_prefix: "drafts/"`, `limit: 100` and the query `Proposed` (every draft body has a `Proposed by:` line). If a project returns 100 hits, say there may be more and review these first. Collect the drafts, oldest first.
2. **Show each draft** in a compact form: type, target unit, title, the quotes, who proposed it and when, and the project it sits in. Ask: approve, edit, or discard. Handle one at a time.
3. **Approve** (or approve after the edits the approver asks for):
   - Write the curated page into the draft's `Target unit`, in its type's folder from `types.md` (for example `decisions/<slug>.md`), with `kind` set to the type and the filled template as the body. Keep `Sources` and `Quotes` at the end under `## Sources`.
   - Rewrite the draft at the same path with the tag `status-approved` instead of `status-pending`, adding `Reviewed by: <Reviewer from the reference>`, `Reviewed at: <YYYY-MM-DD>` and `Curated page: <project>:<path>` to its header block.
4. **Discard:** rewrite the draft with the tag `status-discarded`, adding `Reviewed by`, `Reviewed at` and, when the approver gives one, `Reason:`. Nothing is deleted.
5. **Finish** with a count: approved, discarded, left pending.
