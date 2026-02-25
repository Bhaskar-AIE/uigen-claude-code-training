# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator that provides live preview capabilities. It uses Claude AI (via Anthropic API) to generate React components on the fly, displaying them in a split-pane interface with code editor and live preview. The app operates entirely in-browser with a **virtual file system** - no generated files are written to disk during component generation.

## Commands

### Setup
```bash
npm run setup
```
Runs full setup: installs dependencies, generates Prisma client, and runs database migrations.

### Development
```bash
npm run dev
```
Starts the Next.js development server with Turbopack. Requires `NODE_OPTIONS='--require ./node-compat.cjs'` for Node.js compatibility.

```bash
npm run dev:daemon
```
Starts dev server in background mode, logging to `logs.txt`.

### Build & Production
```bash
npm run build
```
Creates production build.

```bash
npm run start
```
Starts production server.

### Testing
```bash
npm test
```
Runs all tests with Vitest.

To run a specific test file:
```bash
npx vitest run src/lib/__tests__/file-system.test.ts
```

To run tests in watch mode:
```bash
npm test -- --watch
```

### Database
```bash
npx prisma generate
```
Generates Prisma client (outputs to `src/generated/prisma`).

```bash
npx prisma migrate dev
```
Creates and applies new migration.

```bash
npm run db:reset
```
Resets database (drops all data and reapplies migrations).

### Linting
```bash
npm run lint
```
Runs ESLint checks.

## Architecture

### Virtual File System (VFS)

The core innovation is the `VirtualFileSystem` class (`src/lib/file-system.ts`), which provides an in-memory file system that mimics a real filesystem structure:

- **FileNode structure**: Each node represents either a file (with `content`) or directory (with `children` Map)
- **Path normalization**: Ensures consistent path handling (leading slashes, no trailing slashes except root)
- **Operations**: create, read, update, delete, rename files/directories with automatic parent directory creation
- **Serialization**: Converts to/from plain objects for storage in database or transmission over network
- **Used throughout**: VFS is passed to AI tools, updated by tool calls, serialized for database storage, and deserialized for preview

### AI Integration Flow

1. **Chat API** (`src/app/api/chat/route.ts`):
   - Receives messages and serialized VFS from client
   - Reconstructs VFS using `deserializeFromNodes()`
   - Calls `streamText()` with Claude model and tools
   - Tools (`str_replace_editor`, `file_manager`) operate directly on VFS instance
   - On finish, serializes VFS and saves to database (if authenticated)

2. **AI Tools**:
   - `str_replace_editor` (`src/lib/tools/str-replace.ts`): View, create, edit files using string replacement or line insertion
   - `file_manager` (`src/lib/tools/file-manager.ts`): Rename and delete files/directories

3. **Tool Call Handling**:
   - Client-side `ChatContext` (`src/lib/contexts/chat-context.tsx`) listens to `onToolCall` events
   - Forwards to `FileSystemContext` via `handleToolCall()`
   - `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) mirrors tool operations on client-side VFS
   - Triggers UI refresh to reflect changes

### Component Preview System

The preview system transforms TypeScript/JSX files into executable browser code:

1. **JSX Transformer** (`src/lib/transform/jsx-transformer.ts`):
   - Uses `@babel/standalone` to transpile JSX/TSX to plain JavaScript
   - Detects and removes CSS imports (collected separately)
   - Tracks missing imports for resolution
   - Returns syntax errors for display (doesn't fail silently)

2. **Import Map Generation** (`createImportMap()` in `jsx-transformer.ts`):
   - Transforms all VFS files to JavaScript
   - Creates blob URLs for each transformed file
   - Builds import map with multiple path variations (absolute, relative, `@/` alias)
   - Maps third-party packages to `esm.sh` CDN
   - Collects CSS content from `.css` files
   - Creates placeholder modules for missing imports

3. **Preview HTML** (`createPreviewHTML()` in `jsx-transformer.ts`):
   - Generates complete HTML document with import map
   - Includes Tailwind CSS via CDN
   - Shows syntax errors prominently if any exist
   - Wraps app in React ErrorBoundary for runtime error handling
   - Dynamically imports entry point (defaults to `/App.jsx`)

4. **PreviewFrame** (`src/components/preview/PreviewFrame.tsx`):
   - Renders preview in sandboxed iframe with `srcdoc`
   - Regenerates HTML on every file system change
   - Entry point detection (looks for `/App.jsx` or `/App.tsx`)

### State Management

The app uses React Context for state management:

- **FileSystemContext**: Manages VFS instance, selected file, CRUD operations, and tool call handling
- **ChatContext**: Wraps Vercel AI SDK's `useChat`, provides messages, input handling, and connects to FileSystemContext
- Both contexts work in tandem: chat receives tool calls from AI, forwards to file system context to update VFS

### Authentication & Projects

- **Session-based auth** (`src/lib/auth.ts`): Uses JWT tokens stored in cookies, bcrypt for password hashing
- **Middleware** (`src/middleware.ts`): Protects routes, redirects to home if not authenticated
- **Anonymous mode**: Supported - work tracked in localStorage (`src/lib/anon-work-tracker.ts`) with prompt to sign up
- **Projects** (Prisma models):
  - `User`: email, password, relations to projects
  - `Project`: stores serialized messages and VFS data as JSON strings
  - Server actions (`src/actions/`): create-project, get-project, get-projects

### Code Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/chat/          # AI chat endpoint
│   ├── [projectId]/       # Dynamic project page
│   └── page.tsx           # Home/landing page
├── components/
│   ├── auth/              # SignIn/SignUp forms, AuthDialog
│   ├── chat/              # ChatInterface, MessageList, MessageInput, MarkdownRenderer
│   ├── editor/            # CodeEditor (Monaco), FileTree
│   ├── preview/           # PreviewFrame
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── contexts/          # FileSystemContext, ChatContext
│   ├── tools/             # AI tools (str-replace, file-manager)
│   ├── transform/         # jsx-transformer (Babel transpilation)
│   ├── prompts/           # System prompts for AI
│   ├── file-system.ts     # VirtualFileSystem class
│   ├── auth.ts            # Authentication utilities
│   ├── prisma.ts          # Prisma client singleton
│   └── provider.ts        # AI model provider configuration
├── actions/               # Next.js server actions
└── hooks/                 # Custom React hooks
```

## Important Implementation Details

### Path Alias Resolution

The app supports `@/` path aliases (maps to `/` in VFS). The import map generator creates multiple entries per file to support all import variations:
- Absolute: `/components/Button.tsx`
- Relative: `./Button.tsx`, `../Button.tsx`
- Alias: `@/components/Button.tsx`
- Without extension: `/components/Button`

### Mock Provider

When `ANTHROPIC_API_KEY` is not set, the app uses a mock provider that returns static code instead of calling Claude API. This allows development without API costs. The mock provider is detected and `maxSteps` is reduced to prevent repetitive mock responses.

### Database Schema

Prisma uses SQLite with custom output directory (`src/generated/prisma`). The `Project.data` field stores the entire VFS as a JSON string. The `Project.messages` field stores chat history.

### Testing

- Vitest with jsdom environment for React component testing
- Testing Library for component tests
- Tests located in `__tests__` directories alongside source files
- Path aliases resolved via `vite-tsconfig-paths` plugin

## API Key Configuration

The `.env` file should contain:
```
ANTHROPIC_API_KEY=your-api-key-here
```

The app functions without this key (mock mode) but won't generate real AI responses.
- always robust backend first arcitecuture for apis.
- the database schema is defined in the @prisma/schema.prisma file, Reference ut anytime you need to understand the structure of data in the database.