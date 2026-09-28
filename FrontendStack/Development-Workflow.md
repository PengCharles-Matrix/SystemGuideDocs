# Development Workflow

## Standard loop
1. Update main from the remote.
2. Create a feature, fix, or refactor branch.
3. Implement a small, focused change.
4. Run the local development server.
5. Test the affected functionality.
6. Run TypeScript checks.
7. Run the production build.
8. Commit the change.
9. Push the branch.
10. Open a Pull Request.
11. Resolve review/check failures.
12. Merge after required approval and checks.

## Quality gate
Before a PR is opened, verify:
- React 19 is installed.
- TypeScript has no unresolved errors.
- Tailwind CSS v4 is installed and working.
- Vite production build succeeds.
- The changed feature works in the browser.
- No secrets or unnecessary generated files are committed.

## Important
The exact lint, test, and type-check commands depend on the project's package.json. Always inspect the repository scripts rather than assuming command names.
