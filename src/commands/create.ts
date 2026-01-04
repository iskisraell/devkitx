/**
 * create command - Scaffold new projects
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import {
  createProjectConfig,
  writeProjectConfig,
} from "../lib/project-yaml.js";
import { logger } from "../lib/logger.js";
import * as ui from "../ui/theme.js";

export const createCommand = new Command("create")
  .description("Create a new project")
  .argument("[name]", "Project name")
  .option(
    "-t, --template <template>",
    "Template to use (turbo-monorepo, next-only, vite-only)",
  )
  .option(
    "-b, --backend <backend>",
    "Backend to use (convex, supabase, both, none)",
  )
  .option("--skip-install", "Skip installing dependencies")
  .option("--skip-git", "Skip git initialization")
  .option("-v, --verbose", "Show detailed logging")
  .option("-y, --yes", "Skip confirmation prompts (use defaults)")
  .action(async (name: string | undefined, options) => {
    let projectPath = "";
    let projectName = "";

    try {
      console.log();
      p.intro(chalk.bgCyan(chalk.black(" DevKitX - Create Project ")));

      logger.setVerbose(options.verbose ?? false);

      // Get project name
      projectName = name ?? "";
      if (!projectName) {
        const nameResult = await p.text({
          message: "What is your project name?",
          placeholder: "my-awesome-app",
          validate: (value) => {
            if (!value) return "Project name is required";
            if (!/^[a-z0-9-]+$/.test(value))
              return "Use lowercase letters, numbers, and hyphens only";
            return undefined;
          },
        });

        if (p.isCancel(nameResult)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }
        projectName = nameResult as string;
      }

      // Check if directory exists
      projectPath = join(process.cwd(), projectName);
      if (existsSync(projectPath)) {
        p.cancel(`Directory "${projectName}" already exists`);
        process.exit(1);
      }

      // Initialize logger for this project
      mkdirSync(projectPath, { recursive: true });
      logger.init(projectPath);
      logger.info("Starting project creation", {
        projectName,
        template: options.template,
        backend: options.backend,
      });

      // Select template
      let template = options.template;
      if (!template) {
        const templateResult = await p.select({
          message: "What type of project?",
          options: [
            {
              value: "turbo-monorepo",
              label: "Turborepo Monorepo",
              hint: "Next.js + Expo + shared packages",
            },
            {
              value: "next-only",
              label: "Next.js Only",
              hint: "Full-stack Next.js with App Router",
            },
            {
              value: "vite-only",
              label: "Vite + React",
              hint: "Fast SPA with Vite",
            },
          ],
        });

        if (p.isCancel(templateResult)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }
        template = templateResult as string;
      }

      // Select backend
      let backend = options.backend;
      if (!backend) {
        const backendResult = await p.select({
          message: "Select your backend:",
          options: [
            {
              value: "convex",
              label: "Convex",
              hint: "Real-time, serverless backend (recommended)",
            },
            {
              value: "supabase",
              label: "Supabase",
              hint: "PostgreSQL, Auth, Storage",
            },
            {
              value: "both",
              label: "Both",
              hint: "Convex for real-time + Supabase for storage",
            },
            {
              value: "none",
              label: "None",
              hint: "I'll add a backend later",
            },
          ],
        });

        if (p.isCancel(backendResult)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }
        backend = backendResult as string;
      }

      // Select additional features
      let features: string[] = [];
      if (!options.yes) {
        const featuresResult = await p.multiselect({
          message: "Select additional features:",
          options: [
            {
              value: "shadcn",
              label: "shadcn/ui",
              hint: "Beautiful UI components",
            },
            {
              value: "tailwind",
              label: "Tailwind CSS",
              hint: "Utility-first CSS",
            },
            { value: "biome", label: "Biome", hint: "Fast linter & formatter" },
            { value: "playwright", label: "Playwright", hint: "E2E testing" },
            {
              value: "storybook",
              label: "Storybook",
              hint: "Component documentation",
            },
          ],
          required: false,
        });

        if (p.isCancel(featuresResult)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }
        features = featuresResult as string[];
      }

      // Confirm
      if (!options.yes) {
        const shouldProceed = await p.confirm({
          message: `Create "${projectName}" with ${template} template?`,
        });

        if (!shouldProceed || p.isCancel(shouldProceed)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }
      }

      // Start creating project - use explicit logging for better feedback
      console.log();
      console.log(chalk.cyan("Creating project..."));

      console.log(chalk.gray("  [1/7] Creating project directory..."));
      // Note: Directory already created during logger init
      console.log(chalk.green("  [1/7] ✓ Project directory created"));

      console.log(chalk.gray("  [2/7] Generating project configuration..."));
      // Create project.yaml
      const config = createProjectConfig({
        name: projectName,
        template: template as "turbo-monorepo" | "next-only" | "vite-only",
        backend: backend as "convex" | "supabase" | "both" | "none",
        features,
      });

      await writeProjectConfig(config, join(projectPath, "project.yaml"));
      console.log(chalk.green("  [2/7] ✓ Project configuration generated"));

      // Create documentation framework
      console.log(chalk.gray("  [3/7] Creating documentation framework..."));
      await createDocumentationFramework(
        projectPath,
        projectName,
        template,
        backend,
      );
      console.log(chalk.green("  [3/7] ✓ Documentation framework created"));

      // Create template files based on selection
      console.log(chalk.gray(`  [4/7] Scaffolding ${template} template...`));
      await scaffoldTemplate(projectPath, template, backend, features);
      console.log(chalk.green(`  [4/7] ✓ Template scaffolded`));

      // Initialize git
      if (!options.skipGit) {
        console.log(chalk.gray("  [5/7] Initializing git repository..."));
        const gitProc = Bun.spawn(["git", "init"], {
          cwd: projectPath,
          stdout: "ignore",
        });
        await gitProc.exited;
        console.log(chalk.green("  [5/7] ✓ Git repository initialized"));
      } else {
        console.log(chalk.gray("  [5/7] Skipping git initialization"));
      }

      // Install dependencies
      if (!options.skipInstall) {
        console.log(chalk.gray("  [6/7] Installing dependencies..."));
        console.log(chalk.gray("        This may take a few minutes..."));
        const installProc = Bun.spawn(["pnpm", "install"], {
          cwd: projectPath,
          stdout: "inherit",
          stderr: "inherit",
        });
        await installProc.exited;
        console.log(chalk.green("  [6/7] ✓ Dependencies installed"));
      } else {
        console.log(chalk.gray("  [6/7] Skipping dependency installation"));
      }

      // Setup backend
      if (backend === "convex" || backend === "both") {
        console.log(chalk.gray("  [7/7] Setting up Convex..."));
        const convexPath =
          template === "turbo-monorepo" ? projectPath : projectPath;
        mkdirSync(join(convexPath, "convex"), { recursive: true });
        await createConvexFiles(convexPath);
        console.log(chalk.green("  [7/7] ✓ Convex setup complete"));
      } else if (backend === "supabase" || backend === "both") {
        console.log(chalk.gray("  [7/7] Setting up Supabase..."));
        await createSupabaseFiles(projectPath);
        console.log(chalk.green("  [7/7] ✓ Supabase setup complete"));
      } else {
        console.log(chalk.gray("  [7/7] No backend to configure"));
      }

      // Also handle supabase if both
      if (backend === "both") {
        console.log(chalk.gray("        Setting up Supabase..."));
        await createSupabaseFiles(projectPath);
        console.log(chalk.green("        ✓ Supabase setup complete"));
      }

      p.outro(chalk.green("Project created successfully!"));

      // Print next steps
      console.log();
      ui.header("Next Steps");
      console.log(`  ${chalk.cyan("cd")} ${projectName}`);

      if (options.skipInstall) {
        console.log(`  ${chalk.cyan("pnpm install")}`);
      }

      if (backend === "convex" || backend === "both") {
        console.log(`  ${chalk.cyan("npx convex dev")}     # Start Convex`);
      }
      if (backend === "supabase" || backend === "both") {
        console.log(
          `  ${chalk.cyan("supabase start")}     # Start Supabase locally`,
        );
      }

      console.log(
        `  ${chalk.cyan("pnpm dev")}           # Start development server`,
      );
      console.log();
      console.log(chalk.gray("Documentation files created:"));
      console.log(
        `  ${chalk.white("project.yaml")}        - Project configuration`,
      );
      console.log(
        `  ${chalk.white("PROJECT-OVERVIEW.md")} - Architecture overview`,
      );
      console.log(
        `  ${chalk.white("AGENT-EDITABLE.md")}   - AI agent workspace`,
      );
      console.log();

      logger.success("Project created successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Project creation failed", { error: errorMessage });

      p.cancel("Project creation failed");
      console.log();
      ui.error(errorMessage);
      console.log();
      console.log(chalk.gray("To fix issues, run:"));
      console.log(chalk.cyan(`  cd ${projectName}`));
      console.log(chalk.cyan("  dx repair --verbose"));
      console.log();
      console.log(chalk.gray("Log file:"));
      console.log(
        chalk.gray(`  ${join(projectPath, ".devkitx", "setup.log")}`),
      );
      process.exit(1);
    }
  });

/**
 * Create documentation framework files
 */
async function createDocumentationFramework(
  projectPath: string,
  projectName: string,
  template: string,
  backend: string,
): Promise<void> {
  // PROJECT-OVERVIEW.md
  const overviewContent = `# ${projectName}

## Overview

This project was created with DevKitX using the \`${template}\` template.

## Architecture

${
  template === "turbo-monorepo"
    ? `
### Monorepo Structure

\`\`\`
${projectName}/
├── apps/
│   ├── web/          # Next.js web application
│   └── mobile/       # Expo mobile application
├── packages/
│   ├── ui/           # Shared UI components (web)
│   ├── shared/       # Shared utilities and types
│   └── config-*/     # Shared configurations
├── convex/           # Backend functions (if using Convex)
└── project.yaml      # Project configuration
\`\`\`
`
    : `
### Project Structure

\`\`\`
${projectName}/
├── app/              # Next.js App Router pages
├── components/       # React components
├── lib/              # Utilities and helpers
├── convex/           # Backend functions (if using Convex)
└── project.yaml      # Project configuration
\`\`\`
`
}

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | ${template === "vite-only" ? "Vite + React" : "Next.js 15 (App Router)"} |
${template === "turbo-monorepo" ? "| Mobile | Expo + React Native |\n" : ""}| Styling | Tailwind CSS + shadcn/ui |
| Backend | ${backend === "none" ? "None (add later)" : backend === "both" ? "Convex + Supabase" : backend.charAt(0).toUpperCase() + backend.slice(1)} |
| Deployment | Vercel |

## Key Decisions

- Document important architectural decisions here
- Each decision should include context, options considered, and rationale

## Data Flow

\`\`\`
Client Request
    │
    ▼
${backend === "convex" || backend === "both" ? "Convex Functions" : backend === "supabase" ? "Supabase Edge Functions" : "API Routes"}
    │
    ▼
Database
    │
    ▼
Response to Client
\`\`\`

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
${backend === "convex" || backend === "both" ? "- Convex CLI" : ""}
${backend === "supabase" || backend === "both" ? "- Supabase CLI" : ""}

### Getting Started

\`\`\`bash
pnpm install
${backend === "convex" || backend === "both" ? "npx convex dev  # Start Convex in terminal 1" : ""}
pnpm dev        # Start dev server${template === "turbo-monorepo" ? "s" : ""}
\`\`\`

### Environment Variables

See \`.env.example\` for required environment variables.

---

*This file provides a high-level overview. For task-specific context, see AGENT-EDITABLE.md*
`;

  // AGENT-EDITABLE.md
  const agentContent = `# Agent Workspace

> This file is designed for AI coding agents to maintain context between sessions.
> Human developers can also use this for notes and TODOs.

## Current Session

**Last Updated:** ${new Date().toISOString().split("T")[0]}
**Status:** Initial setup complete

## Active Context

### What I'm Working On

- [ ] Initial project setup

### Recent Changes

- Created project with DevKitX
- Template: ${template}
- Backend: ${backend}

### Important Notes

<!-- Add notes that should persist between agent sessions -->

## TODOs

### High Priority

- [ ] Configure environment variables
- [ ] Set up authentication
- [ ] Create initial pages/screens

### Medium Priority

- [ ] Add error boundaries
- [ ] Set up analytics
- [ ] Configure CI/CD

### Low Priority

- [ ] Add E2E tests
- [ ] Performance optimization
- [ ] Documentation

## Code Conventions

### File Naming

- Components: \`PascalCase.tsx\`
- Utilities: \`camelCase.ts\`
- Constants: \`SCREAMING_SNAKE_CASE\`

### Component Structure

\`\`\`tsx
// 1. Imports
// 2. Types/Interfaces
// 3. Component
// 4. Styles (if needed)
// 5. Export
\`\`\`

### State Management

- Server state: ${backend === "convex" || backend === "both" ? "Convex useQuery/useMutation" : backend === "supabase" ? "TanStack Query + Supabase" : "TanStack Query"}
- Client state: React useState/useReducer or Zustand for complex state

## File References

Quick links to important files:

- \`project.yaml\` - Project configuration
- \`${template === "turbo-monorepo" ? "apps/web/app" : "app"}/\` - Main application routes
${backend === "convex" || backend === "both" ? "- `convex/` - Backend functions\n" : ""}${template === "turbo-monorepo" ? "- `packages/shared/` - Shared utilities\n" : ""}

## Session History

### ${new Date().toISOString().split("T")[0]} - Project Creation

- Initialized project with DevKitX
- Set up ${template} structure
- Configured ${backend} backend

---

*Update this file as you work to maintain context for future sessions*
`;

  // README.md
  const readmeContent = `# ${projectName}

${template === "turbo-monorepo" ? "A monorepo" : "A modern web application"} built with DevKitX.

## Quick Start

\`\`\`bash
# Install dependencies
pnpm install

# Start development
pnpm dev
\`\`\`

## Documentation

- [Project Overview](./PROJECT-OVERVIEW.md) - Architecture and technical details
- [Agent Workspace](./AGENT-EDITABLE.md) - Development notes and TODOs

## Scripts

| Command | Description |
|---------|-------------|
| \`pnpm dev\` | Start development server${template === "turbo-monorepo" ? "s" : ""} |
| \`pnpm build\` | Build for production |
| \`pnpm lint\` | Run linter |
${template === "turbo-monorepo" ? "| `pnpm dev --filter=web` | Start web only |\n| `pnpm dev --filter=mobile` | Start mobile only |" : ""}

## License

MIT
`;

  await Promise.all([
    Bun.write(join(projectPath, "PROJECT-OVERVIEW.md"), overviewContent),
    Bun.write(join(projectPath, "AGENT-EDITABLE.md"), agentContent),
    Bun.write(join(projectPath, "README.md"), readmeContent),
  ]);
}

/**
 * Scaffold template files
 */
async function scaffoldTemplate(
  projectPath: string,
  template: string,
  backend: string,
  features: string[],
): Promise<void> {
  const usesTailwind =
    features.includes("tailwind") || features.includes("shadcn");
  const usesShadcn = features.includes("shadcn");

  if (template === "turbo-monorepo") {
    await scaffoldTurboMonorepo(projectPath, backend, usesTailwind, usesShadcn);
  } else if (template === "next-only") {
    await scaffoldNextOnly(projectPath, backend, usesTailwind, usesShadcn);
  } else if (template === "vite-only") {
    await scaffoldViteOnly(projectPath, backend, usesTailwind, usesShadcn);
  }
}

async function scaffoldTurboMonorepo(
  projectPath: string,
  backend: string,
  usesTailwind: boolean,
  usesShadcn: boolean,
): Promise<void> {
  // Create directories
  const dirs = [
    "apps/web/app",
    "apps/web/components",
    "apps/web/lib",
    "apps/mobile/app",
    "apps/mobile/components",
    "packages/ui/src",
    "packages/shared/src",
    "packages/config-tailwind",
    "packages/config-typescript",
  ];

  for (const dir of dirs) {
    mkdirSync(join(projectPath, dir), { recursive: true });
  }

  // Root package.json
  const rootPackageJson = {
    name: projectPath.split("/").pop(),
    private: true,
    scripts: {
      dev: "turbo dev",
      build: "turbo build",
      lint: "turbo lint",
      "type-check": "turbo type-check",
    },
    devDependencies: {
      turbo: "^2.3.0",
      typescript: "^5.7.0",
    },
    packageManager: "pnpm@9.15.0",
  };

  // pnpm-workspace.yaml
  const workspaceYaml = `packages:
  - "apps/*"
  - "packages/*"
`;

  // turbo.json
  const turboJson = {
    $schema: "https://turbo.build/schema.json",
    ui: "tui",
    tasks: {
      build: {
        dependsOn: ["^build"],
        inputs: ["$TURBO_DEFAULT$", ".env*"],
        outputs: [".next/**", "!.next/cache/**", "dist/**"],
      },
      dev: {
        cache: false,
        persistent: true,
      },
      lint: {
        dependsOn: ["^lint"],
      },
      "type-check": {
        dependsOn: ["^type-check"],
      },
    },
  };

  // Web app package.json
  const webPackageJson = {
    name: "web",
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev --turbopack",
      build: "next build",
      start: "next start",
      lint: "next lint",
      "type-check": "tsc --noEmit",
    },
    dependencies: {
      next: "^15.1.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "@repo/ui": "workspace:*",
      "@repo/shared": "workspace:*",
      ...(backend === "convex" || backend === "both"
        ? { convex: "^1.17.0", "convex-helpers": "^0.1.0" }
        : {}),
      ...(backend === "supabase" || backend === "both"
        ? { "@supabase/supabase-js": "^2.47.0", "@supabase/ssr": "^0.5.0" }
        : {}),
    },
    devDependencies: {
      "@types/node": "^22.10.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      typescript: "^5.7.0",
      "@repo/config-typescript": "workspace:*",
      ...(usesTailwind
        ? {
            tailwindcss: "^3.4.0",
            postcss: "^8.4.0",
            autoprefixer: "^10.4.0",
            "@repo/config-tailwind": "workspace:*",
          }
        : {}),
    },
  };

  // Mobile app package.json
  const mobilePackageJson = {
    name: "mobile",
    version: "0.1.0",
    private: true,
    main: "expo-router/entry",
    scripts: {
      dev: "expo start",
      android: "expo run:android",
      ios: "expo run:ios",
      web: "expo start --web",
      lint: "eslint .",
      "type-check": "tsc --noEmit",
    },
    dependencies: {
      expo: "~52.0.0",
      "expo-router": "~4.0.0",
      "expo-status-bar": "~2.0.0",
      react: "^18.3.1",
      "react-native": "^0.76.0",
      "react-native-safe-area-context": "^4.14.0",
      "react-native-screens": "~4.4.0",
      "@repo/shared": "workspace:*",
      ...(backend === "convex" || backend === "both"
        ? { convex: "^1.17.0", "convex-helpers": "^0.1.0" }
        : {}),
      ...(backend === "supabase" || backend === "both"
        ? { "@supabase/supabase-js": "^2.47.0" }
        : {}),
      ...(usesTailwind ? { nativewind: "^4.1.0", tailwindcss: "^3.4.0" } : {}),
    },
    devDependencies: {
      "@types/react": "^18.3.0",
      typescript: "^5.7.0",
    },
  };

  // Shared package
  const sharedPackageJson = {
    name: "@repo/shared",
    version: "0.1.0",
    private: true,
    main: "./src/index.ts",
    types: "./src/index.ts",
    exports: {
      ".": "./src/index.ts",
      "./utils": "./src/utils/index.ts",
      "./types": "./src/types/index.ts",
    },
    devDependencies: {
      typescript: "^5.7.0",
    },
  };

  const sharedIndex = `// Shared utilities and types
export * from './types';
export * from './utils';
`;

  const sharedTypes = `// Shared type definitions

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}

// Add more shared types here
`;

  const sharedUtils = `// Shared utility functions

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Add more shared utilities here
`;

  // UI package
  const uiPackageJson = {
    name: "@repo/ui",
    version: "0.1.0",
    private: true,
    exports: {
      ".": "./src/index.ts",
      "./components/*": "./src/components/*.tsx",
    },
    devDependencies: {
      "@repo/config-typescript": "workspace:*",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      typescript: "^5.7.0",
    },
    peerDependencies: {
      react: "^18.0.0 || ^19.0.0",
      "react-dom": "^18.0.0 || ^19.0.0",
    },
  };

  const uiIndex = `// Shared UI components
// Add your shared components here

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Re-export components as you create them
// export { Button } from "./components/button";
`;

  const uiTsconfig = {
    extends: "@repo/config-typescript/react-library.json",
    compilerOptions: {
      outDir: "./dist",
      rootDir: "./src",
    },
    include: ["src"],
    exclude: ["node_modules", "dist"],
  };

  // Config TypeScript package
  const configTypescriptPackageJson = {
    name: "@repo/config-typescript",
    version: "0.1.0",
    private: true,
    license: "MIT",
    publishConfig: {
      access: "public",
    },
  };

  const tsBaseJson = {
    $schema: "https://json.schemastore.org/tsconfig",
    compilerOptions: {
      strict: true,
      strictNullChecks: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      moduleResolution: "bundler",
      module: "ESNext",
      target: "ES2022",
      lib: ["ES2022"],
      resolveJsonModule: true,
      isolatedModules: true,
      incremental: true,
      declaration: true,
      declarationMap: true,
    },
  };

  const tsNextJson = {
    $schema: "https://json.schemastore.org/tsconfig",
    extends: "./base.json",
    compilerOptions: {
      lib: ["dom", "dom.iterable", "ES2022"],
      jsx: "preserve",
      noEmit: true,
      plugins: [{ name: "next" }],
    },
  };

  const tsReactLibraryJson = {
    $schema: "https://json.schemastore.org/tsconfig",
    extends: "./base.json",
    compilerOptions: {
      lib: ["dom", "dom.iterable", "ES2022"],
      jsx: "react-jsx",
    },
  };

  // Config Tailwind package
  const configTailwindPackageJson = {
    name: "@repo/config-tailwind",
    version: "0.1.0",
    private: true,
    exports: {
      ".": "./tailwind.config.ts",
    },
    devDependencies: {
      tailwindcss: "^3.4.0",
    },
  };

  const sharedTailwindConfig = `import type { Config } from "tailwindcss";

const config: Omit<Config, "content"> = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
`;

  // Write all files
  await Promise.all([
    // Root files
    Bun.write(
      join(projectPath, "package.json"),
      JSON.stringify(rootPackageJson, null, 2),
    ),
    Bun.write(join(projectPath, "pnpm-workspace.yaml"), workspaceYaml),
    Bun.write(
      join(projectPath, "turbo.json"),
      JSON.stringify(turboJson, null, 2),
    ),
    Bun.write(join(projectPath, ".gitignore"), gitignoreContent),
    Bun.write(join(projectPath, ".env.example"), envExampleContent(backend)),

    // Web app
    Bun.write(
      join(projectPath, "apps/web/package.json"),
      JSON.stringify(webPackageJson, null, 2),
    ),

    // Mobile app
    Bun.write(
      join(projectPath, "apps/mobile/package.json"),
      JSON.stringify(mobilePackageJson, null, 2),
    ),

    // Shared package
    Bun.write(
      join(projectPath, "packages/shared/package.json"),
      JSON.stringify(sharedPackageJson, null, 2),
    ),
    Bun.write(join(projectPath, "packages/shared/src/index.ts"), sharedIndex),
    Bun.write(
      join(projectPath, "packages/shared/src/types/index.ts"),
      sharedTypes,
    ),
    Bun.write(
      join(projectPath, "packages/shared/src/utils/index.ts"),
      sharedUtils,
    ),

    // UI package
    Bun.write(
      join(projectPath, "packages/ui/package.json"),
      JSON.stringify(uiPackageJson, null, 2),
    ),
    Bun.write(join(projectPath, "packages/ui/src/index.ts"), uiIndex),
    Bun.write(
      join(projectPath, "packages/ui/tsconfig.json"),
      JSON.stringify(uiTsconfig, null, 2),
    ),

    // Config TypeScript package
    Bun.write(
      join(projectPath, "packages/config-typescript/package.json"),
      JSON.stringify(configTypescriptPackageJson, null, 2),
    ),
    Bun.write(
      join(projectPath, "packages/config-typescript/base.json"),
      JSON.stringify(tsBaseJson, null, 2),
    ),
    Bun.write(
      join(projectPath, "packages/config-typescript/nextjs.json"),
      JSON.stringify(tsNextJson, null, 2),
    ),
    Bun.write(
      join(projectPath, "packages/config-typescript/react-library.json"),
      JSON.stringify(tsReactLibraryJson, null, 2),
    ),

    // Config Tailwind package
    Bun.write(
      join(projectPath, "packages/config-tailwind/package.json"),
      JSON.stringify(configTailwindPackageJson, null, 2),
    ),
    Bun.write(
      join(projectPath, "packages/config-tailwind/tailwind.config.ts"),
      sharedTailwindConfig,
    ),
  ]);

  // Create Next.js config and pages
  await createNextAppFiles(
    join(projectPath, "apps/web"),
    usesTailwind,
    usesShadcn,
  );

  // Create Expo config and pages
  await createExpoAppFiles(join(projectPath, "apps/mobile"), usesTailwind);
}

async function scaffoldNextOnly(
  projectPath: string,
  backend: string,
  usesTailwind: boolean,
  usesShadcn: boolean,
): Promise<void> {
  const dirs = ["app", "components", "lib"];
  for (const dir of dirs) {
    mkdirSync(join(projectPath, dir), { recursive: true });
  }

  const packageJson = {
    name: projectPath.split("/").pop(),
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev --turbopack",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
    dependencies: {
      next: "^15.1.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      ...(backend === "convex" || backend === "both"
        ? { convex: "^1.17.0" }
        : {}),
      ...(backend === "supabase" || backend === "both"
        ? { "@supabase/supabase-js": "^2.47.0", "@supabase/ssr": "^0.5.0" }
        : {}),
    },
    devDependencies: {
      "@types/node": "^22.10.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      typescript: "^5.7.0",
      ...(usesTailwind
        ? { tailwindcss: "^3.4.0", postcss: "^8.4.0", autoprefixer: "^10.4.0" }
        : {}),
    },
  };

  await Promise.all([
    Bun.write(
      join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    ),
    Bun.write(join(projectPath, ".gitignore"), gitignoreContent),
    Bun.write(join(projectPath, ".env.example"), envExampleContent(backend)),
  ]);

  await createNextAppFiles(projectPath, usesTailwind, usesShadcn);
}

async function scaffoldViteOnly(
  projectPath: string,
  backend: string,
  usesTailwind: boolean,
  usesShadcn: boolean,
): Promise<void> {
  const dirs = ["src/components", "src/lib"];
  for (const dir of dirs) {
    mkdirSync(join(projectPath, dir), { recursive: true });
  }

  const packageJson = {
    name: projectPath.split("/").pop(),
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
      lint: "eslint .",
    },
    dependencies: {
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "react-router-dom": "^7.1.0",
      ...(backend === "convex" || backend === "both"
        ? { convex: "^1.17.0" }
        : {}),
      ...(backend === "supabase" || backend === "both"
        ? { "@supabase/supabase-js": "^2.47.0" }
        : {}),
    },
    devDependencies: {
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@vitejs/plugin-react": "^4.3.0",
      typescript: "^5.7.0",
      vite: "^6.0.0",
      ...(usesTailwind
        ? { tailwindcss: "^3.4.0", postcss: "^8.4.0", autoprefixer: "^10.4.0" }
        : {}),
    },
  };

  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectPath.split("/").pop()}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
${usesTailwind ? "import './index.css'" : ""}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;

  const appTsx = `function App() {
  return (
    <div${usesTailwind ? ' className="min-h-screen bg-background"' : ""}>
      <main${usesTailwind ? ' className="container mx-auto p-8"' : ""}>
        <h1${usesTailwind ? ' className="text-4xl font-bold"' : ""}>
          Welcome to your app
        </h1>
        <p${usesTailwind ? ' className="text-muted-foreground mt-2"' : ""}>
          Built with DevKitX
        </p>
      </main>
    </div>
  )
}

export default App
`;

  await Promise.all([
    Bun.write(
      join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    ),
    Bun.write(join(projectPath, "vite.config.ts"), viteConfig),
    Bun.write(join(projectPath, "index.html"), indexHtml),
    Bun.write(join(projectPath, "src/main.tsx"), mainTsx),
    Bun.write(join(projectPath, "src/App.tsx"), appTsx),
    Bun.write(join(projectPath, ".gitignore"), gitignoreContent),
    Bun.write(join(projectPath, ".env.example"), envExampleContent(backend)),
  ]);

  if (usesTailwind) {
    await createTailwindConfig(projectPath, "vite");
  }
}

async function createNextAppFiles(
  appPath: string,
  usesTailwind: boolean,
  usesShadcn: boolean,
): Promise<void> {
  const nextConfig = `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
`;

  const layoutTsx = `import type { Metadata } from 'next'
${usesTailwind ? "import './globals.css'" : ""}

export const metadata: Metadata = {
  title: 'My App',
  description: 'Built with DevKitX',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body${usesTailwind ? ' className="min-h-screen bg-background antialiased"' : ""}>
        {children}
      </body>
    </html>
  )
}
`;

  const pageTsx = `export default function Home() {
  return (
    <main${usesTailwind ? ' className="container mx-auto p-8"' : ""}>
      <h1${usesTailwind ? ' className="text-4xl font-bold"' : ""}>
        Welcome to your app
      </h1>
      <p${usesTailwind ? ' className="text-muted-foreground mt-2"' : ""}>
        Built with DevKitX
      </p>
    </main>
  )
}
`;

  const tsconfig = {
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: {
        "@/*": ["./*"],
      },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };

  await Promise.all([
    Bun.write(join(appPath, "next.config.ts"), nextConfig),
    Bun.write(join(appPath, "app/layout.tsx"), layoutTsx),
    Bun.write(join(appPath, "app/page.tsx"), pageTsx),
    Bun.write(
      join(appPath, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2),
    ),
  ]);

  if (usesTailwind) {
    await createTailwindConfig(appPath, "next");
  }
}

async function createExpoAppFiles(
  appPath: string,
  usesTailwind: boolean,
): Promise<void> {
  const appConfig = `{
  "expo": {
    "name": "mobile",
    "slug": "mobile",
    "version": "1.0.0",
    "scheme": "mobile",
    "platforms": ["ios", "android"],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#ffffff"
      }
    },
    "plugins": ["expo-router"]
  }
}
`;

  const layoutTsx = `import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
    </Stack>
  );
}
`;

  const indexTsx = `import { View, Text, StyleSheet } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to your app</Text>
      <Text style={styles.subtitle}>Built with DevKitX</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
});
`;

  const tsconfig = {
    extends: "expo/tsconfig.base",
    compilerOptions: {
      strict: true,
      paths: {
        "@/*": ["./*"],
      },
    },
    include: ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
  };

  await Promise.all([
    Bun.write(join(appPath, "app.json"), appConfig),
    Bun.write(join(appPath, "app/_layout.tsx"), layoutTsx),
    Bun.write(join(appPath, "app/index.tsx"), indexTsx),
    Bun.write(
      join(appPath, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2),
    ),
  ]);
}

async function createTailwindConfig(
  projectPath: string,
  type: "next" | "vite",
): Promise<void> {
  const content =
    type === "next"
      ? "./app/**/*.{js,ts,jsx,tsx,mdx}"
      : "./src/**/*.{js,ts,jsx,tsx}";

  const tailwindConfig = `import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    '${content}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
      },
    },
  },
  plugins: [],
}

export default config
`;

  const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

  const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
  }
}
`;

  const cssPath = type === "next" ? "app/globals.css" : "src/index.css";

  await Promise.all([
    Bun.write(join(projectPath, "tailwind.config.ts"), tailwindConfig),
    Bun.write(join(projectPath, "postcss.config.js"), postcssConfig),
    Bun.write(join(projectPath, cssPath), globalsCss),
  ]);
}

async function createConvexFiles(projectPath: string): Promise<void> {
  const schema = `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Example table - customize as needed
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
  }).index("by_email", ["email"]),
});
`;

  const exampleQuery = `import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
`;

  await Promise.all([
    Bun.write(join(projectPath, "convex/schema.ts"), schema),
    Bun.write(join(projectPath, "convex/users.ts"), exampleQuery),
  ]);
}

async function createSupabaseFiles(projectPath: string): Promise<void> {
  const clientTs = `import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
`;

  mkdirSync(join(projectPath, "lib"), { recursive: true });
  await Bun.write(join(projectPath, "lib/supabase.ts"), clientTs);
}

const gitignoreContent = `# Dependencies
node_modules
.pnpm-store

# Build outputs
.next
.expo
dist
.turbo

# Environment
.env
.env.local
.env*.local

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# TypeScript
*.tsbuildinfo

# Convex
.convex
`;

function envExampleContent(backend: string): string {
  let content = `# Environment Variables
# Copy this to .env.local and fill in the values

`;

  if (backend === "convex" || backend === "both") {
    content += `# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

`;
  }

  if (backend === "supabase" || backend === "both") {
    content += `# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

`;
  }

  content += `# Add your other environment variables here
`;

  return content;
}
