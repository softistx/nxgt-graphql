# CLAUDE.md

This file exists so Claude Code picks up this repository's agent instructions.
It deliberately holds no guidance of its own.

## Read AGENTS.md first

**[AGENTS.md](./AGENTS.md) is the single source of truth.** Everything that
applies to any coding agent working here lives there: what the repository is,
the layering, the green bar, and the traps already paid for.

## Skills

The skills come from the `nxgt-core` marketplace, enabled in the committed
`.claude/settings.json`: `nxgt-base`, a bundle that brings `nxgt-monorepo`,
`nxgt-docs`, `nxgt-review`, `nxgt-autonomy` and `nxgt-economy`; plus
`nxgt-workflow` and `nxgt-package`. They are authored in `softistx/nxgt-core`,
under `plugins/`; nothing is copied here.

A skill that is genuinely only about this repository goes in
`.claude/skills/<name>/SKILL.md`.

## Keeping it that way

Add new agent guidance to `AGENTS.md`, never here. This file should only ever
grow content that is genuinely Claude Code-specific.
