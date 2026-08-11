// The public route is /test-lab (app/(app)/test-lab/page.tsx) - URL segments
// use kebab-case by web convention. This slice folder is test_lab (snake_case)
// because it is also a TypeScript module identifier, and every other
// multi-word identifier in this repo (domain files, the eslint boundaries
// `feature` capture, PACT-573's grandfathered import list) uses snake_case.
// The two names deliberately differ; do not "fix" one to match the other -
// renaming the folder to kebab-case would also require updating
// eslint.config.mjs's boundaries matrix, AGENTS.md's grandfathered import
// list, and Playwright's testDir globs, none of which are broken today.
export { TestLabWorkbench } from './ui/TestLabWorkbench';
