---
name: memory-propose
description: Propose a decision, rule, gotcha, procedure or fact from the current conversation to the company memory, as a draft that waits for approval. Use when the person says things like "anota isso como decisão", "isso é uma regra", "registra esse gotcha", "propõe isso pra memória", or asks to record, note or remember something for the team.
---

# Propose an item to the company memory

Answer the person in the person's language. Never call `memory_delete_page`.

Read `reference.md` (next to this file) and load the person's reference first. Read `types.md` for the formats.

## Steps

1. **Classify.** Use the type the person names; otherwise apply the seven questions in `types.md`. If it is an action, tell the person to put it in their task tool and stop. If it fails the three-months filter, say so and ask whether to record it anyway.
2. **Fill the template** for that type from the conversation. Use only what was said; put the exact lines that back it under `Quotes`. Ask one short question only for a missing piece the template needs (for a decision: the reason).
3. **Pick the target unit** from **Writes** or **Reads** in the reference. Ask the person to confirm when more than one fits.
4. **Write the draft** (`drafts/<YYYY-MM-DD>-<type>-<slug>.md`, `kind: draft`, tags `draft`, `status-pending`, `type-<type>`) into a project from **Writes**: the target itself when the person writes it, otherwise the written project closest to it (same parent or linked).
5. **Changing an earlier draft.** If the person wants to change or withdraw a draft they proposed and it is still `status-pending`, rewrite it (same path) with the change, or with the tag `status-withdrawn`. Never change an approved or discarded draft.
6. **Report:** the draft's path, its type and target, and that it enters the memory only after approval.
