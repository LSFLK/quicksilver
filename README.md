# Handa

A modern React-based email client implementing the Email 2.0 vision.

## The Vision: Email 2.0

Email 2.0 reimagines email as something an order of magnitude more productive and user-friendly than current email systems. The vision integrates:

- **Modern messaging UX**: Conversational UI with threads that can compete with WhatsApp in simplicity
- **Security & Privacy by Design**: Built-in identity, authentication, and privacy features
- **Roles & Groups**: Support for individual users, organizational roles, and temporary assignments
- **Multilingual Support**: Sinhala and Tamil language support with translation
- **Offline-First**: Reliable functionality even with flaky connectivity
- **Smart Organization**: AI-powered categorization beyond folders and labels
- **Integrated Workflows**: First-class support for attachments, calendars, tasks, and forms

See [docs/Email-2.md](docs/Email-2.md) for the complete vision.

## Architecture

**Handa** is the email client component that works with **Silver**, the Email 2.0 server that implements the complete philosophy. Together, they form a complete email solution for the modern era.

## Technology Stack

- React 19 + TypeScript
- Vite (build tool & dev server)
- MUI (Material UI) for components
- Modern UI/UX frameworks
- Offline-first architecture
- End-to-end encryption support

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- npm 9+ (comes with Node)

### Install

```bash
npm install
```

### Available Scripts

| Command             | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Start the Vite dev server with HMR (default: http://localhost:3000/handa/) |
| `npm start`         | Alias for `npm run dev`                                      |
| `npm run build`     | Build the production bundle to `build/`                      |
| `npm run preview`   | Preview the production build locally                         |
| `npm run typecheck` | Run the TypeScript compiler in `--noEmit` mode (no build)    |

### Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:3000/handa/ in your browser.

## Development Roadmap

### Milestone 1: Foundation & Core UI

**Goal**: Basic email client functionality with modern UX

- React application setup and architecture
- Authentication and connection to Silver server
- Inbox view with email list
- Conversational UI for reading emails and threads
- Basic compose and send functionality
- Responsive design for mobile and desktop
- Security by design: encrypted connections

**Deliverable**: A working email client that can read, compose, and send emails with a WhatsApp-like conversational interface.

### Milestone 2: Enhanced Features & Roles

**Goal**: User roles, offline support, and multilingual capabilities

- User roles and groups management
- Offline access and sync capabilities
- Sinhala and Tamil language support with basic translation
- Dependable search functionality
- Read receipts and typing indicators
- Draft auto-save
- Settings and preferences management

**Deliverable**: A production-ready email client with role-based features and offline capabilities.

### Milestone 3: Integrated Productivity

**Goal**: First-class support for attachments, calendars, tasks, and forms

- Advanced attachment handling (preview, inline display, versioning)
- Integrated calendar view and management
- Task management within email threads
- Forms creation and submission
- Custom workflows and automation rules
- Document authentication and signing
- Scheduled emails and un-send functionality

**Deliverable**: A comprehensive productivity platform built on email infrastructure.

### Milestone 4: Intelligence & Analytics

**Goal**: AI-powered features and advanced capabilities

- AI-powered email categorization and tagging
- Smart summaries of email threads
- Email-to-email agent workflows
- Analytics on email use and productivity
- Collaboration on documents
- TTL (Time-to-Live) for emails with validity periods
- Expectations management for response times

**Deliverable**: An intelligent email system that enhances productivity through AI and automation.
