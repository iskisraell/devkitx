# DevKitX

A powerful CLI toolkit for modern web development. Create, manage, and deploy projects with Next.js, Vite, Expo, Turborepo, Convex, Supabase, and more.

```
╔═══════════════════════════════════════════╗
║  DevKitX - Developer Toolkit CLI          ║
║  v1.0.0                                   ║
╚═══════════════════════════════════════════╝
```

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
version: 1.0.0
created: 2025-01-04

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with Bun, TypeScript, and @clack/prompts
