# DevKitX

A powerful CLI toolkit for modern web development with built-in **Ralphy** autonomous AI coding support. Create, manage, and deploy projects with Next.js, Vite, Expo, Turborepo, Convex, Supabase, and more.

```
╔═══════════════════════════════════════════╗
║  DevKitX - Developer Toolkit CLI          ║
║  v0.1.1-beta (Ralphy Support)             ║
╚═══════════════════════════════════════════╝
```

## ⭐ What's New in v0.1.1-beta

**Ralphy Integration** - Autonomous AI Coding Loops

- Run AI agents in loops until PRD completion
- Parallel execution via git worktrees
- Auto branch/PR creation
- YAML task files for dependency management
- Full documentation with `dx ralph help --export`

[Changelog →](https://github.com/iskisraell/devkitx/releases)

## Quick Install (Windows)

Open PowerShell and run:

```powershell
irm https://raw.githubusercontent.com/iskisraell/devkitx/main/install.ps1 | iex
```

Or with curl:

```powershell
curl -fsSL https://raw.githubusercontent.com/iskisraell/devkitx/main/install.ps1 | powershell -
```

## What You Get

After installation, you'll have access to the `dx` command with these features:

### Project Creation

```powershell
dx create my-app                    # Interactive project wizard
dx create my-app --template next    # Next.js app
dx create my-app --template turbo   # Turborepo monorepo
dx create my-app --template vite    # Vite + React app
```

### Project Management

```powershell
dx list                   # Find all DevKitX projects
dx status                 # Health check (deps, git, TypeScript)
dx info                   # Show project configuration
dx go <name>              # Switch to project (use 'go' alias after install)
dx open                   # Open in VS Code
dx open github            # Open GitHub repo
dx open vercel            # Open Vercel dashboard
```

### Maintenance

```powershell
dx clean                  # Remove node_modules, .next, .turbo, etc.
dx repair                 # Fix incomplete installations
dx delete                 # Safe project deletion with backup
dx undo                   # Restore last deleted project
```

### Documentation

```powershell
dx docs next              # Open Next.js docs
dx docs shadcn            # Open shadcn/ui docs
dx docs tailwind          # Open Tailwind CSS docs
dx docs convex            # Open Convex docs
```

### Deployment

```powershell
dx deploy                 # Deploy to Vercel + backend
dx env                    # Manage environment variables
```

### Ralphy - Autonomous AI Coding

```powershell
dx ralph init                     # Initialize project for Ralphy
dx ralph install                  # Install ralphy.sh (one time)
dx ralph new <name>               # Create a new PRD file
dx ralph new -y <name>            # Create YAML task file
dx ralph run                      # Run Ralphy with OpenCode
dx ralph run --parallel           # Run with parallel agents
dx ralph run --create-pr          # Auto-create pull requests
dx ralph status                   # Check Ralphy setup status
```

## Features

- **One-command project creation** - Scaffolds complete projects with all configs
- **Turborepo monorepo support** - Creates apps/, packages/, and shared configs
- **Smart project discovery** - Finds all your projects across common directories
- **Interactive prompts** - Beautiful CLI experience with @clack/prompts
- **Safe deletion** - Type-to-confirm + automatic backups
- **Health checks** - Verify dependencies, git status, TypeScript errors
- **Quick navigation** - Switch between projects instantly

## Project Templates

### Turborepo Monorepo (`--template turbo`)

```
my-app/
├── apps/
│   └── web/              # Next.js application
├── packages/
│   ├── ui/               # Shared React components
│   ├── config-typescript/# Shared TypeScript configs
│   └── config-tailwind/  # Shared Tailwind configs
├── turbo.json
├── pnpm-workspace.yaml
└── project.yaml          # DevKitX project config
```

### Next.js App (`--template next`)

```
my-app/
├── src/
│   ├── app/              # App Router
│   ├── components/
│   └── lib/
├── tailwind.config.ts
├── next.config.js
└── project.yaml
```

### Vite + React (`--template vite`)

```
my-app/
├── src/
│   ├── components/
│   ├── App.tsx
│   └── main.tsx
├── vite.config.ts
├── tailwind.config.ts
└── project.yaml
```

## Shell Integration

After installation, these PowerShell functions are available:

```powershell
go <name>        # Switch to project directory (cd wrapper)
dxgo <name>      # Same as 'go'
dxc <name>       # Shortcut for 'dx create'
dxl              # Shortcut for 'dx list'
dxs              # Shortcut for 'dx status'
dxo              # Shortcut for 'dx open'

# Git shortcuts
gs               # git status
gp               # git push
gl               # git pull
gd               # git diff
glog             # git log --oneline --graph

# pnpm shortcuts
pd               # pnpm dev
pb               # pnpm build
pi               # pnpm install
```

## Requirements

- **Windows 10/11** with PowerShell 5.1+
- **Bun** (auto-installed if missing)
- **pnpm** (recommended, auto-installed via Corepack)
- **Git** (for project management features)

## Manual Installation

If you prefer to install manually:

1. **Install Bun**

   ```powershell
   irm bun.sh/install.ps1 | iex
   ```

2. **Clone and build**

   ```powershell
   git clone https://github.com/iskisraell/devkitx.git
   cd devkitx
   bun install
   bun run build
   ```

3. **Add to PATH**

   ```powershell
   mkdir -Force "$env:USERPROFILE\.devkitx\bin"
   cp dist/dx.exe "$env:USERPROFILE\.devkitx\bin\"

   # Add to PATH permanently
   $path = [Environment]::GetEnvironmentVariable("Path", "User")
   [Environment]::SetEnvironmentVariable("Path", "$path;$env:USERPROFILE\.devkitx\bin", "User")
   ```

4. **Load shell enhancements** (optional)
   ```powershell
   # Add to your $PROFILE
   . "$env:USERPROFILE\.devkitx\profile-additions.ps1"
   ```

## Configuration

DevKitX projects are configured via `project.yaml`:

```yaml
name: my-app
version: 0.1.1-beta
created: 2025-01-17

stack:
  monorepo: true
  package_manager: pnpm

  apps:
    web:
      framework: next.js 15
      path: apps/web

  backend:
    primary: convex # or supabase

  styling:
    framework: tailwindcss
    ui_library: shadcn/ui
```

## Roadmap

- [ ] Linux/macOS support
- [ ] `dx upgrade` - Update project dependencies
- [ ] `dx test` - Run tests across monorepo
- [ ] `dx lint` - Lint and format code
- [ ] Custom templates
- [ ] Plugin system

## Ralphy Integration

DevKitX includes built-in support for **Ralphy** - an autonomous bash script that runs AI coding agents (OpenCode, Claude Code, Codex, Cursor) in a loop until your PRD is complete.

### What is Ralphy?

Ralphy transforms AI coding assistants from single-pass tools into persistent, self-correcting development machines. It supports:

- **Parallel execution** - Multiple agents working simultaneously via git worktrees
- **Branch-per-task** - Automatic feature branches for each task
- **Auto-PRs** - Automatically create pull requests when tasks complete
- **Multiple engines** - OpenCode (default), Claude Code, Codex, Cursor
- **YAML task dependencies** - Group tasks that can run in parallel

### Quick Start

```powershell
# 1. Install Ralphy (one time)
dx ralph install

# 2. Initialize your project
dx ralph init

# 3. Create a PRD for your feature
dx ralph new my-feature

# 4. Edit the PRD with your requirements
code docs/prd/my-feature.prd.md

# 5. Run Ralphy!
dx ralph run --prd docs/prd/my-feature.prd.md
```

### Run Options

```powershell
# Basic run with default PRD.md
dx ralph run

# Run specific PRD
dx ralph run --prd docs/prd/my-feature.prd.md

# Parallel execution (3 agents in git worktrees)
dx ralph run --parallel

# More parallel agents
dx ralph run --parallel --max-parallel 5

# Feature branch workflow with auto PRs
dx ralph run --branch-per-task --create-pr

# Fast mode (skip tests and linting)
dx ralph run --fast

# Dry run to preview what would happen
dx ralph run --dry-run

# YAML task file with dependencies
dx ralph run --yaml tasks.yaml
```

### Direct Shell Access

You can also run ralphy.sh directly from any Git Bash terminal:

```bash
# Add to PATH (one time)
export PATH="$HOME/.ralphy:$PATH"

# Then from any project
ralphy --opencode --prd PRD.md
ralphy --opencode --parallel --max-parallel 4
ralphy --opencode --branch-per-task --create-pr
```

### What Gets Created

When you run `dx ralph init`, these files are created:

```
your-project/
├── AGENTS.md              # AI agent instructions and project context
├── PRD.md                 # Default PRD file
├── progress.txt           # Progress log (required by ralphy.sh)
├── .ralph/
│   └── signs.md           # Project-specific rules for Ralph
└── docs/
    └── prd/               # PRD files directory
```

### PRD Structure

Product Requirement Documents (PRDs) are the key to effective Ralphy loops:

```markdown
# PRD: Feature Name

## TL;DR

- One sentence: what are we shipping?

## Goal

- What outcome should exist when done?

## Constraints

- What should NOT be changed

## Acceptance Criteria

- [ ] Observable success conditions
- [ ] Edge cases you care about

## Verification

- Commands to prove it works

## Progress

- Updated by Ralphy after each iteration
```

### YAML Task Files

For parallel execution with dependencies, use YAML:

```yaml
tasks:
  # Group 1: Foundation (runs first)
  - title: "Create user model"
    completed: false
    parallel_group: 1

  - title: "Create post model"
    completed: false
    parallel_group: 1

  # Group 2: Depends on group 1
  - title: "Add user-post relationships"
    completed: false
    parallel_group: 2
```

### Ralph's Commandments

1. **THOU SHALT NOT STOP** - Complete the task before stopping
2. **THOU SHALT LOOK FOR SIGNS** - Read .ralph/signs.md for project rules
3. **THOU SHALT BE DETERMINISTIC** - Be reliably persistent
4. **THOU SHALT TUNE NOT BLAME** - When failing, tune prompts not tools
5. **THOU SHALT ITERATE** - Every failure is a learning opportunity

Learn more: https://github.com/michaelshimeles/ralphy

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with Bun, TypeScript, and @clack/prompts
