# React 19

## Purpose

React is the UI library used to build the application's component tree and interactive behavior.

## Project rules

- Use React 19 as the required major version.
- Prefer functional components and hooks.
- Keep components focused on one responsibility.
- Keep reusable UI components separate from feature-specific components.
- Avoid unnecessary global state.

## Typical structure

src/
  components/    reusable UI
  features/      feature modules
  pages/         route-level views
  hooks/         reusable hooks
  lib/           shared utilities
  types/         shared TypeScript types

## Verification

Check package.json for the installed React and React DOM versions before starting work.
