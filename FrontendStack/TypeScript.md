# TypeScript

## Purpose

TypeScript provides static typing for the React application and helps detect incorrect data usage before runtime.

## Project rules

- Use .ts and .tsx for application source code.
- Avoid any unless there is a documented reason.
- Define interfaces or type aliases for application data.
- Type component props explicitly when inference is insufficient.
- Type API responses and shared domain models.
- Keep strict compiler checking enabled.

## Recommended tsconfig baseline

Use strict TypeScript settings and verify them with the project's tsconfig files.

## Verification

Run the project's type-check command before opening a Pull Request.
