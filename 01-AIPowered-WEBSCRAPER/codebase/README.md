# Scrape Board

A full-stack project management application built with React, TypeScript, Tailwind CSS, and Supabase. Features include Kanban boards, AI-powered task breakdown using Google Gemini, and website scraping with Firecrawl.

## Features

- **Authentication**: Secure email/password authentication with Supabase Auth
- **Board Management**: Create and manage multiple project boards
- **Kanban View**: Drag-and-drop tasks across To-Do, In Progress, and Done columns
- **Task Management**:
  - Create, edit, and delete tasks
  - Add descriptions and due dates
  - Manage subtasks with completion tracking
- **AI Task Breakdown**: Use Google Gemini to automatically break down complex tasks into actionable subtasks
- **Website Scraping**: Extract titles, headings, and links from websites using Firecrawl and convert them to tasks
- **Dark/Light Mode**: Beautiful theme support with animated neon orbs background
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Auth)
- **Drag & Drop**: @dnd-kit
- **AI**: Google Gemini API (`gemini-2.5-flash`)
- **Scraping**: Firecrawl API (`/v1/scrape`)
- **Routing**: React Router v7

## Prerequisites

- Node.js 16+ and npm
- A Supabase account and project
- Google Gemini API key (required for AI breakdown)
- Firecrawl API key (required for the website scraper)

## Setup Instructions

### 1. Clone and Install

```bash
npm install
```

### 2. Create a Supabase Project

1. Create a free account at [supabase.com](https://supabase.com) and start a new project.
2. At creation time, under **Security**: leave **Enable Data API** checked (required — it's what exposes your tables as a REST API for `supabase-js`) and leave **Automatically expose new tables** unchecked (recommended default; this project's RLS policies handle authorization explicitly).
3. Open **SQL Editor → New query**, paste the entire contents of [`supabase/migrations/20251208093543_create_project_management_schema.sql`](supabase/migrations/20251208093543_create_project_management_schema.sql), and run it. This creates all five tables plus RLS policies scoped to `auth.uid()`.
4. **Run this once after the schema** — leaving "auto-expose new tables" off also skips granting the `authenticated` role basic table privileges, which causes every query to fail with `403 Forbidden` even though RLS is configured correctly:
   ```sql
   GRANT USAGE ON SCHEMA public TO authenticated;
   GRANT SELECT, INSERT, UPDATE, DELETE ON boards TO authenticated;
   GRANT SELECT, INSERT, UPDATE, DELETE ON columns TO authenticated;
   GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;
   GRANT SELECT, INSERT, UPDATE, DELETE ON subtasks TO authenticated;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ai_breakdown_sessions TO authenticated;
   ```
5. Under **Authentication → URL Configuration**, set **Site URL** to wherever you're deploying (not the `localhost:3000` default) and add it to **Redirect URLs** — otherwise signup confirmation emails link to a dead localhost address.
6. Copy the project's **URL** and **anon key** from **Settings → API**.

### 3. Get Firecrawl and Gemini API Keys

- **Firecrawl**: Sign up at [firecrawl.dev](https://firecrawl.dev) (free tier available) and generate an API key. The app calls the current `/v1/scrape` endpoint — the older `/v0/scrape` is deprecated and returns errors.
- **Gemini**: Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The app targets `gemini-2.5-flash`; Google periodically retires model aliases, so if AI breakdown reports a "model no longer available" error, check [Google's current model list](https://ai.google.dev/gemini-api/docs/models) and update `src/services/ai.ts`.

### 4. Configure Environment Variables

Create `.env` in the project root (never commit this file):

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

Vite bakes these into the build at compile time — set them before running `npm run build`, and rebuild after any change (editing `.env` alone doesn't affect an already-built `dist/`).

### 5. Run the Application

```bash
npm run dev
```

## Deploying to Static/Shared Hosting (e.g. GoDaddy)

This app has no server-side runtime — `npm run build` compiles everything into plain static files in `dist/`, which can be served from any static host, including shared hosting without Node.js support.

1. Populate `.env` (above), then `npm run build`. Produces `dist/index.html` + `dist/assets/*`.
2. Upload the **contents** of `dist/` (not the folder itself, and not `src/`, `node_modules/`, `.env`, or `package.json`) to your host's document root.
3. Since this app uses `react-router-dom` client-side routing, add an `.htaccess` (Apache) alongside `index.html` so deep-linked/refreshed routes don't 404:
   ```apache
   RewriteEngine On
   RewriteBase /
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.html [L]
   ```
4. Vite fingerprints output filenames per build and wipes `dist/` on every rebuild — re-add `.htaccess` and re-upload the full `dist/` contents (deleting stale old files first) after every code or env change.

## Usage Guide

### Getting Started

1. **Sign Up/Sign In**: Create a new account or sign in with existing credentials
2. **Create a Board**: Click "New Board" on the dashboard to create your first project board
3. **Add Tasks**: Click "Add Task" in any column to create a new task

### Using AI Task Breakdown

1. Open a task by clicking on it
2. Add a detailed title and description
3. Click "AI Breakdown" to generate subtasks automatically
4. Review the AI-generated subtasks
5. Click "Accept All" to add them or "Regenerate" for new suggestions

### Using Website Scraper

1. On the dashboard, find the "Website Scraper" panel
2. Enter a URL and click "Scrape Website"
3. Select items you want to convert to tasks
4. Click "Add as Tasks" and choose which board to add them to

### Managing Tasks

- **Drag & Drop**: Move tasks between columns by dragging them
- **Edit**: Click on any task to open the task modal and edit details
- **Subtasks**: Add and manage subtasks within the task modal
- **Delete**: Use the "Delete Task" button in the task modal

### Theme Toggle

Click the sun/moon icon in the header to switch between light and dark modes.

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   └── neon-orbs.tsx  # Animated background
│   ├── TaskCard.tsx     # Draggable task card
│   └── TaskModal.tsx    # Task editing modal
├── contexts/
│   ├── AuthContext.tsx  # Authentication state
│   └── ThemeContext.tsx # Theme management
├── lib/
│   ├── supabase.ts      # Supabase client
│   └── utils.ts         # Utility functions
├── pages/
│   ├── Auth.tsx         # Login/signup page
│   ├── Dashboard.tsx    # Main dashboard
│   └── BoardView.tsx    # Kanban board view
├── services/
│   ├── ai.ts            # Google Gemini integration
│   └── firecrawl.ts     # Firecrawl scraping service
├── types/
│   └── database.ts      # TypeScript types
├── App.tsx              # Main app with routing
└── main.tsx             # Entry point
```

## API Integration Details

### Google Gemini API

The AI service uses the `gemini-2.5-flash` model to analyze task descriptions and generate actionable subtasks. The system is configured to:
- Generate 3-7 subtasks per task
- Return structured JSON responses
- Handle errors gracefully with user-friendly messages

### Firecrawl API

The scraping service extracts structured data from websites:
- Titles and headings (H1, H2, H3)
- Links with anchor text
- Converts markdown to selectable items

## Security Features

- Row Level Security (RLS) on all database tables
- User authentication with Supabase Auth
- Protected routes requiring authentication
- Owner-based access control for all resources

**Note on API keys:** Gemini and Firecrawl keys are read from `VITE_*` environment variables, but Vite inlines `VITE_*` values into the public JS bundle at build time — they are visible to anyone who opens dev tools on the deployed site, not held server-side. This is a known, accepted trade-off for this build's scope (see the README's "Approach" section); a production version would proxy both calls through a backend/edge function to keep the keys server-side. The Supabase anon key is safe to expose by design — it's meant to be public and access is enforced by RLS, not by keeping it secret.

## Building for Production

```bash
npm run build
```

The production build will be created in the `dist/` directory.

## Troubleshooting

### AI Features Not Working
- Ensure `VITE_GEMINI_API_KEY` is set in your `.env` file
- Check that you have a valid Google AI Studio API key
- Verify your API key has not exceeded its quota

### Scraping Not Working
- Ensure `VITE_FIRECRAWL_API_KEY` is set in your `.env` file
- Check that the URL you're trying to scrape is accessible
- Verify your Firecrawl account has available credits

### Database Errors
- Check that all Supabase environment variables are correct
- Ensure your Supabase project is active
- Verify RLS policies are properly configured
- A `403 Forbidden` on every query (not just some rows) usually means the `authenticated` role was never granted table privileges — see step 2.4 in Setup Instructions above; RLS policies alone don't grant access, they only filter it after access is already permitted
- If auth confirmation emails link to `localhost:3000` and fail to load, update **Site URL** and **Redirect URLs** under Authentication → URL Configuration in Supabase to point at your actual deployed domain

### Deployed Site Shows Stale Behavior After a Fix
- Vite fingerprints build output filenames and wipes `dist/` on every `npm run build` — a code or `.env` change requires rebuilding *and* re-uploading the full `dist/` contents, including a fresh `.htaccess` if you're on Apache-based hosting (it gets wiped too)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
