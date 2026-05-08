# pact-web

Frontend for the [PACT Toolkit](https://github.com/orgs/PACT-Toolkit/repositories) — a suite of services for data privacy, policy enforcement, and compliance automation.

Built with Next.js 16, React 18, Tailwind CSS, and shadcn/ui.

---

## Backend Services

| Service         | Role                                                                        |
| --------------- | --------------------------------------------------------------------------- |
| pact-gateway    | API gateway — single entry point; enforces rate limits and quotas           |
| pact-classifier | Classifies data for sensitivity, category, and prompt injection patterns    |
| pact-policy     | Policy management, evaluation, and agent scope/permission definitions       |
| pact-redactor   | Redacts sensitive data and system prompt patterns from inputs and outputs   |
| pact-filter     | Filters content against policy rules, bidirectionally on inputs and outputs |
| pact-audit      | Audit trail and event logging                                               |
| pact-consensus  | Consent and approval flows                                                  |
| pact-benchmark  | Performance benchmarking and consumption quota tracking                     |

> Service repositories are private. Contact the maintainers for access.

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install

```bash
pnpm install
pnpm run msw:init   # one-time MSW service worker setup
```

### Develop

```bash
pnpm run dev:mock   # against MSW mocked data (recommended)
pnpm run dev        # against real backend
```

The app runs at [http://localhost:3000](http://localhost:3000).

---

## Tech Stack

| Layer           | Tool                             |
| --------------- | -------------------------------- |
| Framework       | Next.js 16 (App Router)          |
| UI library      | React 18                         |
| Styling         | Tailwind CSS                     |
| Components      | shadcn/ui + Radix primitives     |
| Data fetching   | SWR + Orval-generated REST hooks |
| API mocking     | MSW                              |
| Testing         | Vitest (unit) · Playwright (E2E) |
| Package manager | pnpm                             |

---

## Project Structure

```
src/
├── app/            # Feature modules (one folder per feature)
├── components/
│   └── ui/         # shadcn/ui components (edit freely)
├── __codegen__/
│   └── rest/       # Orval-generated REST hooks (DO NOT EDIT)
└── pages/          # Next.js page routes
schema/             # Swagger specs per backend service
```

See [AGENTS.md](AGENTS.md) for agent and AI-assistant guidance.
See [docs/architecture.md](docs/architecture.md) for full architecture, patterns, and principles.

---

## Scripts

```bash
pnpm run dev:mock        # Dev server with mock data
pnpm run dev             # Dev server against real backend
pnpm run test            # Unit tests (Vitest)
pnpm run test:watch      # Unit tests in watch mode
pnpm run pw:open         # Playwright E2E UI
pnpm run pw:run          # Playwright E2E headless
pnpm run lint            # TypeScript + ESLint
pnpm api:update          # Fetch swagger specs + regenerate REST hooks
pnpm rest:codegen        # Regenerate REST hooks only
```
