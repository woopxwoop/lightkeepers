# Patch notes

Markdown in this folder is the **source of truth** for Lightkeepers updates.

## UI

Popup + pages sit on **true black** (`--background-color` / page base), not `--background-mid`.

**Do not use yellow/gold (`--accent-1`) text on black** — it reads murky. Use cream (`--foreground-color` / `--foreground-mid`) for labels on black. Gold is fine as a solid fill (e.g. primary button with dark label text), not as yellow-on-black type.

## Authoring

1. Add `YYYY-MM-DD-short-slug.md` (see existing files).
2. Frontmatter:

```yaml
---
title: Short title
date: 2026-08-11
summary: One-line blurb for the index, Discord embed, and GitHub Release.
---
```

3. Body is GitHub-flavored markdown (headings, lists, links, bold/italic).
4. Merge to `main`. The **Patch notes** workflow creates a GitHub Release and posts to Discord when files here change (requires `DISCORD_PATCH_WEBHOOK_URL` secret).

The website reads these files at `/patch-notes`.
