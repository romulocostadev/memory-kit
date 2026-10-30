---
name: memory-ask
description: Answer questions about the company's clients, contracts, projects, decisions, rules, gotchas and procedures from the company memory, with citations. Use for any question about the company's own work ("o que foi decidido sobre…", "qual a regra de…", "o que diz o contrato do…"), before answering from general knowledge.
---

# Ask the company memory

Answer the person in the person's language. Never call `memory_delete_page`.

Read `reference.md` (next to this file) and load the person's reference first.

## Steps

1. **Search** with `memory_query`, passing `scopes` with every project under **Writes** and **Reads** (each as `{workspace, project}`). Use the person's own words plus the key terms as the query. When the question names a unit, search that project first.
2. **Read** the curated pages that match (`decisions/`, `_rules/`, `gotchas/`, `procedures/`, `concepts/`, `meetings/`, `docs/`) in full with `memory_read_page`. Open the source page (`sources/…`) when the answer needs the original wording.
3. **Answer** with what the pages say, citing each page as `<project>:<path>`. Say when an item is only a pending draft (`drafts/`, tag `status-pending`): it is not approved knowledge yet.
4. **Nothing found:** say so plainly. Never answer company facts from general knowledge or guesses. Offer to record the answer as a proposal (memory-propose) if the person knows it.
