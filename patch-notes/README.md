# Patch notes

Markdown in this folder is the **source of truth** for Lightkeepers updates.

## Authoring

1. Add `YYYY-MM-DD-short-slug.md` (see existing files).
2. Frontmatter:

```yaml
---
title: Short title
date: 2026-08-10
summary: One-line blurb for the index, Discord embed, and GitHub Release.
---
```

3. Body is GitHub-flavored markdown (headings, lists, links, bold/italic).
4. Merge to `main`. The **Patch notes** workflow creates a GitHub Release and posts to Discord when files here change (requires `DISCORD_PATCH_WEBHOOK_URL` secret).

The website reads these files at `/patch-notes`.
