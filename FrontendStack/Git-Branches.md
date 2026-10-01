# Git Branch Standard

## Purpose

Branches isolate work from the stable main branch and make changes easier to review.

## Required branches

main
  Stable integration branch.

feature/<name>
  New functionality.

fix/<name>
  Bug fixes.

refactor/<name>
  Structural changes that should not alter intended behavior.

## Rules

- Never develop directly on main.
- Create a branch from the current main branch before implementation.
- Keep commits focused and descriptive.
- Push the branch to the remote repository.
- Open a Pull Request when the work is ready.
