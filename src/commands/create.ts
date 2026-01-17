/**
 * create command - Enhanced project scaffolding with shadcn/ui
 *
 * Features:
 * - Package manager selection with recommendations
 * - shadcn/ui integration with theme customization
 * - State manager selection (Zustand/Jotai)
 * - Core utilities (clsx, tailwind-merge, lucide-react, framer-motion)
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { join, basename } from "path";
import { existsSync, mkdirSync, rmSync } from "fs";
import { platform } from "os";
import {
  createProjectConfig,
  writeProjectConfig,
} from "../lib/project-yaml.js";
import { logger } from "../lib/logger.js";
import * as ui from "../ui/theme.js";
import {
  type PackageManager,
  type AccentTheme,
  type Font,
  type StateManager,
  ACCENT_THEMES,
  FONTS,
  FONT_LABELS,
  THEME_DISPLAY,
  DEFAULTS,
  buildShadcnCreateCommand,
  buildShadcnAddCommand,
  getPackageManagerRecommendations,
  getStateManagerRecommendations,
  CORE_DEPENDENCIES,
  STATE_MANAGER_DEPS,
  BASE_SHADCN_COMPONENTS,
} from "../lib/shadcn-config.js";

// ============================================================================
// TYPES
// ============================================================================

interface ProjectConfig {
  name: string;
  template: "turbo-monorepo" | "next-only" | "vite-only";
  backend: "convex" | "supabase" | "both" | "none";
  packageManager: PackageManager;
  theme: AccentTheme;
  font: Font;
  stateManager: StateManager;
}

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const createCommand = new Command("create")
  .description("Create a new project with shadcn/ui")
  .argument("[name]", "Project name")
  .option(
    "-t, --template <template>",
    "Template: turbo-monorepo, next-only, vite-only",
  )
  .option("-b, --backend <backend>", "Backend: convex, supabase, both, none")
  .option("-p, --pm <pm>", "Package manager: pnpm, bun, npm")
  .option("--theme <theme>", "Accent theme color")
  .option("--font <font>", "Font family")
  .option("--skip-install", "Skip installing dependencies")
  .option("--skip-git", "Skip git initialization")
  .option("-v, --verbose", "Show detailed logging")
  .option("-y, --yes", "Use defaults, skip prompts")
  .action(async (name: string | undefined, options) => {
    try {
      console.log();
      p.intro(chalk.bgCyan(chalk.black(" DevKitX - Create Project ")));

      logger.setVerbose(options.verbose ?? false);

      // ========================================
      // STEP 1: Get project name
      // ========================================
      let projectName = name ?? "";
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
      const projectPath = join(process.cwd(), projectName);
      if (existsSync(projectPath)) {
        p.cancel(`Directory "${projectName}" already exists`);
        process.exit(1);
      }

      // ========================================
      // STEP 2: Select template
      // ========================================
      let template = options.template as ProjectConfig["template"];
      if (!template) {
        const templateResult = await p.select({
          message: "What type of project?",
          options: [
            {
              value: "next-only",
              label: "Next.js",
              hint: "Full-stack Next.js 15 with App Router",
            },
            {
              value: "vite-only",
              label: "Vite + React",
              hint: "Fast SPA with Vite and React 19",
            },
            {
              value: "turbo-monorepo",
              label: "Turborepo Monorepo",
              hint: "Next.js + shared packages (mobile-ready)",
            },
          ],
        });

        if (p.isCancel(templateResult)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }
        template = templateResult as ProjectConfig["template"];
      }

      // ========================================
      // STEP 3: Select package manager
      // ========================================
      let packageManager = options.pm as PackageManager;
      if (!packageManager && !options.yes) {
        const pmOptions = getPackageManagerRecommendations(template);

        const pmResult = await p.select({
          message: "Which package manager?",
          options: pmOptions.map((pm) => ({
            value: pm.manager,
            label: pm.recommended
              ? `${pm.label} ${chalk.green("(recommended)")}`
              : pm.label,
            hint: pm.hint,
          })),
        });

        if (p.isCancel(pmResult)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }
        packageManager = pmResult as PackageManager;
      } else if (!packageManager) {
        // Default based on template
        packageManager = template === "vite-only" ? "bun" : "pnpm";
      }

      // ========================================
      // STEP 4: Select backend
      // ========================================
      let backend = options.backend as ProjectConfig["backend"];
      if (!backend && !options.yes) {
        const backendResult = await p.select({
          message: "Select your backend:",
          options: [
            {
              value: "convex",
              label: `Convex ${chalk.green("(recommended)")}`,
              hint: "Real-time, serverless backend",
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
        backend = backendResult as ProjectConfig["backend"];
      } else if (!backend) {
        backend = "convex";
      }

      // ========================================
      // STEP 5: shadcn/ui theme customization
      // ========================================
      let theme: AccentTheme = (options.theme as AccentTheme) ?? DEFAULTS.theme;
      let font: Font = (options.font as Font) ?? DEFAULTS.font;

      if (!options.theme && !options.yes) {
        const themeMode = await p.select({
          message: "shadcn/ui theme:",
          options: [
            {
              value: "default",
              label: "Default",
              hint: `Zinc theme with Inter font`,
            },
            {
              value: "personalize",
              label: "Personalize",
              hint: "Choose your accent color and font",
            },
          ],
        });

        if (p.isCancel(themeMode)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }

        if (themeMode === "personalize") {
          // Theme color selection
          const themeResult = await p.select({
            message: "Accent color:",
            options: ACCENT_THEMES.map((t) => ({
              value: t,
              label: `${THEME_DISPLAY[t].emoji} ${THEME_DISPLAY[t].label}`,
            })),
          });

          if (p.isCancel(themeResult)) {
            p.cancel("Operation cancelled");
            process.exit(0);
          }
          theme = themeResult as AccentTheme;

          // Font selection
          const fontResult = await p.select({
            message: "Font family:",
            options: FONTS.map((f) => ({
              value: f,
              label: FONT_LABELS[f],
              hint: f === "inter" ? "Default" : undefined,
            })),
          });

          if (p.isCancel(fontResult)) {
            p.cancel("Operation cancelled");
            process.exit(0);
          }
          font = fontResult as Font;
        }
      }

      // ========================================
      // STEP 6: State manager selection
      // ========================================
      let stateManager: StateManager = "zustand";
      if (!options.yes) {
        const smOptions = getStateManagerRecommendations(template, backend);

        const smResult = await p.select({
          message: "State management:",
          options: smOptions.map((sm) => ({
            value: sm.manager,
            label: sm.recommended
              ? `${sm.label} ${chalk.green("(recommended)")}`
              : sm.label,
            hint: sm.hint,
          })),
        });

        if (p.isCancel(smResult)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }
        stateManager = smResult as StateManager;
      }

      // ========================================
      // STEP 7: Confirmation
      // ========================================
      if (!options.yes) {
        console.log();
        console.log(chalk.white("  Project Configuration:"));
        console.log(chalk.gray("  ─────────────────────────────"));
        console.log(
          `  ${chalk.gray("Name:")}        ${chalk.cyan(projectName)}`,
        );
        console.log(`  ${chalk.gray("Template:")}    ${chalk.cyan(template)}`);
        console.log(
          `  ${chalk.gray("Package Mgr:")} ${chalk.cyan(packageManager)}`,
        );
        console.log(`  ${chalk.gray("Backend:")}     ${chalk.cyan(backend)}`);
        console.log(`  ${chalk.gray("Theme:")}       ${chalk.cyan(theme)}`);
        console.log(
          `  ${chalk.gray("Font:")}        ${chalk.cyan(FONT_LABELS[font])}`,
        );
        console.log(
          `  ${chalk.gray("State:")}       ${chalk.cyan(stateManager || "none")}`,
        );
        console.log();

        const shouldProceed = await p.confirm({
          message: "Create project with these settings?",
        });

        if (!shouldProceed || p.isCancel(shouldProceed)) {
          p.cancel("Operation cancelled");
          process.exit(0);
        }
      }

      // ========================================
      // EXECUTION: Create the project
      // ========================================
      console.log();
      console.log(chalk.cyan("Creating project..."));

      const config: ProjectConfig = {
        name: projectName,
        template,
        backend,
        packageManager,
        theme,
        font,
        stateManager,
      };

      // Determine shadcn template type
      const shadcnTemplate = template === "vite-only" ? "vite" : "next";

      // For monorepo, we'll create structure first then add shadcn to web app
      if (template === "turbo-monorepo") {
        await createMonorepoProject(projectPath, config, options);
      } else {
        await createSingleProject(projectPath, config, shadcnTemplate, options);
      }

      // ========================================
      // SUCCESS
      // ========================================
      p.outro(chalk.green("Project created successfully!"));

      // Print next steps
      console.log();
      ui.header("Next Steps");
      console.log(`  ${chalk.cyan("cd")} ${projectName}`);

      if (options.skipInstall) {
        console.log(`  ${chalk.cyan(`${packageManager} install`)}`);
      }

      if (backend === "convex" || backend === "both") {
        console.log(`  ${chalk.cyan("npx convex dev")}     # Start Convex`);
      }
      if (backend === "supabase" || backend === "both") {
        console.log(
          `  ${chalk.cyan("supabase start")}     # Start Supabase locally`,
        );
      }

      const devCmd =
        packageManager === "npm" ? "npm run dev" : `${packageManager} dev`;
      console.log(
        `  ${chalk.cyan(devCmd)}           # Start development server`,
      );
      console.log();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Project creation failed", { error: errorMessage });

      p.cancel("Project creation failed");
      console.log();
      ui.error(errorMessage);
      process.exit(1);
    }
  });

// ============================================================================
// WINDOWS BUN WORKAROUND
// ============================================================================

/**
 * Check if we need to use pnpm workaround for Bun on Windows
 * Bun has issues with paths containing spaces on Windows
 */
function needsBunWorkaround(
  projectPath: string,
  packageManager: PackageManager,
): boolean {
  if (packageManager !== "bun") return false;
  if (platform() !== "win32") return false;
  // Check if path contains spaces
  return projectPath.includes(" ");
}

/**
 * Get the package manager to use for shadcn create
 * Uses pnpm as fallback when Bun has issues with spaces on Windows
 */
function getShadcnCreatePackageManager(
  projectPath: string,
  requestedPm: PackageManager,
): { pm: PackageManager; usingWorkaround: boolean } {
  if (needsBunWorkaround(projectPath, requestedPm)) {
    return { pm: "pnpm", usingWorkaround: true };
  }
  return { pm: requestedPm, usingWorkaround: false };
}

// ============================================================================
// SINGLE PROJECT CREATION (Next.js or Vite)
// ============================================================================

async function createSingleProject(
  projectPath: string,
  config: ProjectConfig,
  shadcnTemplate: "next" | "vite",
  options: { skipInstall?: boolean; skipGit?: boolean },
): Promise<void> {
  const { name, packageManager, theme, font, backend, stateManager } = config;
  const parentDir = join(projectPath, "..");

  // Step 1: Run shadcn create command
  console.log(chalk.gray("  [1/6] Creating project with shadcn..."));

  // Check if we need workaround for Bun on Windows with spaces in path
  const { pm: createPm, usingWorkaround } = getShadcnCreatePackageManager(
    projectPath,
    packageManager,
  );

  if (usingWorkaround) {
    console.log(
      chalk.yellow(
        "  ⚠ Using pnpm for initial setup (Bun has issues with spaces in paths on Windows)",
      ),
    );
  }

  // Set HOME to a temp directory to avoid shadcn scanning user directory
  const originalHome = process.env.HOME;
  process.env.HOME = join(projectPath, "..", ".temp_home");

  const createCmd = buildShadcnCreateCommand({
    packageManager: createPm,
    template: shadcnTemplate,
    theme,
    font,
    projectName: name,
  });

  const createProc = Bun.spawn(createCmd, {
    cwd: parentDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  await createProc.exited;

  // Restore HOME
  process.env.HOME = originalHome;

  if (!existsSync(projectPath)) {
    throw new Error("shadcn create failed - project directory not created");
  }
  console.log(chalk.green("  [1/6] ✓ Project created with shadcn"));

  // Step 2: Install core utilities
  console.log(chalk.gray("  [2/6] Installing core utilities..."));
  await installDependencies(projectPath, packageManager, [
    ...CORE_DEPENDENCIES,
  ]);
  console.log(chalk.green("  [2/6] ✓ Core utilities installed"));

  // Step 3: Install state manager
  if (stateManager !== "none") {
    console.log(chalk.gray(`  [3/6] Installing ${stateManager}...`));
    await installDependencies(
      projectPath,
      packageManager,
      STATE_MANAGER_DEPS[stateManager],
    );
    await createStateManagerFiles(projectPath, stateManager, shadcnTemplate);
    console.log(chalk.green(`  [3/6] ✓ ${stateManager} installed`));
  } else {
    console.log(chalk.gray("  [3/6] Skipping state manager"));
  }

  // Step 4: Install base shadcn components
  console.log(chalk.gray("  [4/6] Installing base UI components..."));
  const addCmd = buildShadcnAddCommand(packageManager, [
    ...BASE_SHADCN_COMPONENTS,
  ]);
  const addProc = Bun.spawn(addCmd, {
    cwd: projectPath,
    stdout: "pipe",
    stderr: "pipe",
  });
  await addProc.exited;
  console.log(chalk.green("  [4/6] ✓ Base UI components installed"));

  // Step 5: Setup backend
  if (backend !== "none") {
    console.log(chalk.gray(`  [5/6] Setting up ${backend}...`));
    await setupBackend(projectPath, backend, packageManager, shadcnTemplate);
    console.log(chalk.green(`  [5/6] ✓ Backend configured`));
  } else {
    console.log(chalk.gray("  [5/6] Skipping backend setup"));
  }

  // Step 6: Create project.yaml and documentation
  console.log(chalk.gray("  [6/6] Creating project configuration..."));
  await createProjectFiles(projectPath, config);
  console.log(chalk.green("  [6/6] ✓ Project configuration created"));

  // Initialize git
  if (!options.skipGit) {
    const gitProc = Bun.spawn(["git", "init"], {
      cwd: projectPath,
      stdout: "ignore",
    });
    await gitProc.exited;
  }
}

// ============================================================================
// MONOREPO PROJECT CREATION
// ============================================================================

async function createMonorepoProject(
  projectPath: string,
  config: ProjectConfig,
  options: { skipInstall?: boolean; skipGit?: boolean },
): Promise<void> {
  const { name, packageManager, theme, font, backend, stateManager } = config;

  // Step 1: Create monorepo structure
  console.log(chalk.gray("  [1/8] Creating monorepo structure..."));
  await createMonorepoStructure(projectPath, config);
  console.log(chalk.green("  [1/8] ✓ Monorepo structure created"));

  // Step 2: Create web app with shadcn
  console.log(chalk.gray("  [2/8] Creating web app with shadcn..."));
  const webPath = join(projectPath, "apps", "web");

  // Check if we need workaround for Bun on Windows with spaces in path
  const { pm: createPm, usingWorkaround } = getShadcnCreatePackageManager(
    projectPath,
    packageManager,
  );

  if (usingWorkaround) {
    console.log(
      chalk.yellow(
        "  ⚠ Using pnpm for initial setup (Bun has issues with spaces in paths on Windows)",
      ),
    );
  }

  // Set HOME to a temp directory to avoid shadcn scanning user directory
  const originalHome = process.env.HOME;
  process.env.HOME = join(projectPath, "..", ".temp_home");

  const createCmd = buildShadcnCreateCommand({
    packageManager: createPm,
    template: "next",
    theme,
    font,
    projectName: "web",
  });

  const createProc = Bun.spawn(createCmd, {
    cwd: join(projectPath, "apps"),
    stdout: "inherit",
    stderr: "inherit",
  });
  await createProc.exited;

  // Restore HOME
  process.env.HOME = originalHome;
  console.log(chalk.green("  [2/8] ✓ Web app created"));

  // Step 3: Install dependencies at root
  if (!options.skipInstall) {
    console.log(chalk.gray("  [3/8] Installing monorepo dependencies..."));
    const installProc = Bun.spawn([packageManager, "install"], {
      cwd: projectPath,
      stdout: "inherit",
      stderr: "inherit",
    });
    await installProc.exited;
    console.log(chalk.green("  [3/8] ✓ Dependencies installed"));
  } else {
    console.log(chalk.gray("  [3/8] Skipping dependency installation"));
  }

  // Step 4: Install core utilities to web app
  console.log(chalk.gray("  [4/8] Installing core utilities..."));
  await installDependencies(webPath, packageManager, [...CORE_DEPENDENCIES]);
  console.log(chalk.green("  [4/8] ✓ Core utilities installed"));

  // Step 5: Install state manager
  if (stateManager !== "none") {
    console.log(chalk.gray(`  [5/8] Installing ${stateManager}...`));
    await installDependencies(
      webPath,
      packageManager,
      STATE_MANAGER_DEPS[stateManager],
    );
    await createStateManagerFiles(webPath, stateManager, "next");
    console.log(chalk.green(`  [5/8] ✓ ${stateManager} installed`));
  } else {
    console.log(chalk.gray("  [5/8] Skipping state manager"));
  }

  // Step 6: Install base shadcn components
  console.log(chalk.gray("  [6/8] Installing base UI components..."));
  const addCmd = buildShadcnAddCommand(packageManager, [
    ...BASE_SHADCN_COMPONENTS,
  ]);
  const addProc = Bun.spawn(addCmd, {
    cwd: webPath,
    stdout: "pipe",
    stderr: "pipe",
  });
  await addProc.exited;
  console.log(chalk.green("  [6/8] ✓ Base UI components installed"));

  // Step 7: Setup backend
  if (backend !== "none") {
    console.log(chalk.gray(`  [7/8] Setting up ${backend}...`));
    await setupBackend(projectPath, backend, packageManager, "next");
    console.log(chalk.green(`  [7/8] ✓ Backend configured`));
  } else {
    console.log(chalk.gray("  [7/8] Skipping backend setup"));
  }

  // Step 8: Create project.yaml and documentation
  console.log(chalk.gray("  [8/8] Creating project configuration..."));
  await createProjectFiles(projectPath, config);
  console.log(chalk.green("  [8/8] ✓ Project configuration created"));

  // Initialize git
  if (!options.skipGit) {
    const gitProc = Bun.spawn(["git", "init"], {
      cwd: projectPath,
      stdout: "ignore",
    });
    await gitProc.exited;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function installDependencies(
  projectPath: string,
  packageManager: PackageManager,
  deps: string[],
): Promise<void> {
  if (deps.length === 0) return;

  const cmd =
    packageManager === "npm"
      ? ["npm", "install", ...deps]
      : [packageManager, "add", ...deps];

  const proc = Bun.spawn(cmd, {
    cwd: projectPath,
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
}

async function createStateManagerFiles(
  projectPath: string,
  stateManager: StateManager,
  template: "next" | "vite",
): Promise<void> {
  const libPath =
    template === "next"
      ? join(projectPath, "lib")
      : join(projectPath, "src", "lib");

  mkdirSync(libPath, { recursive: true });

  if (stateManager === "zustand") {
    const zustandStore = `import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppState {
  // Add your state here
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
        decrement: () => set((state) => ({ count: state.count - 1 })),
      }),
      {
        name: 'app-storage',
      }
    )
  )
);
`;
    await Bun.write(join(libPath, "store.ts"), zustandStore);
  } else if (stateManager === "jotai") {
    const jotaiAtoms = `import { atom } from 'jotai';

// Primitive atoms
export const countAtom = atom(0);

// Derived atoms
export const doubledCountAtom = atom((get) => get(countAtom) * 2);

// Writable derived atoms
export const incrementAtom = atom(
  (get) => get(countAtom),
  (get, set) => set(countAtom, get(countAtom) + 1)
);
`;
    await Bun.write(join(libPath, "atoms.ts"), jotaiAtoms);
  }
}

async function setupBackend(
  projectPath: string,
  backend: string,
  packageManager: PackageManager,
  template: "next" | "vite",
): Promise<void> {
  const webPath = existsSync(join(projectPath, "apps", "web"))
    ? join(projectPath, "apps", "web")
    : projectPath;

  if (backend === "convex" || backend === "both") {
    // Install Convex
    await installDependencies(webPath, packageManager, ["convex"]);

    // Create convex directory
    const convexPath = join(projectPath, "convex");
    mkdirSync(convexPath, { recursive: true });

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
      Bun.write(join(convexPath, "schema.ts"), schema),
      Bun.write(join(convexPath, "users.ts"), exampleQuery),
    ]);
  }

  if (backend === "supabase" || backend === "both") {
    // Install Supabase
    const supaDeps =
      template === "next"
        ? ["@supabase/supabase-js", "@supabase/ssr"]
        : ["@supabase/supabase-js"];
    await installDependencies(webPath, packageManager, supaDeps);

    const libPath =
      template === "next" ? join(webPath, "lib") : join(webPath, "src", "lib");
    mkdirSync(libPath, { recursive: true });

    const clientTs = `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ${template === "next" ? "process.env.NEXT_PUBLIC_SUPABASE_URL!" : "import.meta.env.VITE_SUPABASE_URL"};
const supabaseAnonKey = ${template === "next" ? "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!" : "import.meta.env.VITE_SUPABASE_ANON_KEY"};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;

    await Bun.write(join(libPath, "supabase.ts"), clientTs);
  }

  // Create .env.example
  let envContent = `# Environment Variables
# Copy this to .env.local and fill in the values

`;

  if (backend === "convex" || backend === "both") {
    envContent += `# Convex
CONVEX_DEPLOYMENT=
${template === "next" ? "NEXT_PUBLIC_CONVEX_URL=" : "VITE_CONVEX_URL="}

`;
  }

  if (backend === "supabase" || backend === "both") {
    const prefix = template === "next" ? "NEXT_PUBLIC_" : "VITE_";
    envContent += `# Supabase
${prefix}SUPABASE_URL=
${prefix}SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

`;
  }

  await Bun.write(join(webPath, ".env.example"), envContent);
}

async function createProjectFiles(
  projectPath: string,
  config: ProjectConfig,
): Promise<void> {
  const { name, template, backend, packageManager, theme, font, stateManager } =
    config;

  // Create project.yaml
  const projectYaml = `name: ${name}
version: 1.0.0
created: ${new Date().toISOString().split("T")[0]}

stack:
  package_manager: ${packageManager}
  monorepo: ${template === "turbo-monorepo"}
  
  apps:
    web:
      framework: ${template === "vite-only" ? "vite" : "next.js 15"}
      path: ${template === "turbo-monorepo" ? "apps/web" : "."}
  
  backend:
    primary: ${backend}
  
  styling:
    framework: tailwindcss
    ui_library: shadcn/ui
    theme: ${theme}
    font: ${font}
  
  state:
    manager: ${stateManager}
  
  libraries:
    icons: lucide-react
    animations: framer-motion
    utilities:
      - clsx
      - tailwind-merge
`;

  await Bun.write(join(projectPath, "project.yaml"), projectYaml);

  // Create documentation files
  await createDocumentationFramework(projectPath, name, template, backend);
}

async function createDocumentationFramework(
  projectPath: string,
  projectName: string,
  template: string,
  backend: string,
): Promise<void> {
  const overviewContent = `# ${projectName}

## Overview

This project was created with DevKitX using the \`${template}\` template.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | ${template === "vite-only" ? "Vite + React 19" : "Next.js 15 (App Router)"} |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | ${backend === "none" ? "None" : backend} |
| Icons | Lucide React |
| Animations | Framer Motion |

## Getting Started

\`\`\`bash
# Install dependencies (if not already installed)
pnpm install

# Start development
pnpm dev
\`\`\`

---

*See AGENT-EDITABLE.md for development notes*
`;

  const agentContent = `# Agent Workspace

> This file is for AI coding agents to maintain context between sessions.

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

## TODOs

### High Priority

- [ ] Configure environment variables
- [ ] Set up authentication
- [ ] Create initial pages/screens

---

*Update this file as you work to maintain context for future sessions*
`;

  await Promise.all([
    Bun.write(join(projectPath, "PROJECT-OVERVIEW.md"), overviewContent),
    Bun.write(join(projectPath, "AGENT-EDITABLE.md"), agentContent),
  ]);
}

async function createMonorepoStructure(
  projectPath: string,
  config: ProjectConfig,
): Promise<void> {
  const { name, packageManager } = config;

  // Create directories
  const dirs = [
    "apps",
    "packages/shared/src",
    "packages/config-typescript",
    "packages/config-tailwind",
  ];

  for (const dir of dirs) {
    mkdirSync(join(projectPath, dir), { recursive: true });
  }

  // Root package.json
  const rootPackageJson = {
    name,
    private: true,
    scripts: {
      dev: "turbo dev",
      build: "turbo build",
      lint: "turbo lint",
    },
    devDependencies: {
      turbo: "^2.3.0",
      typescript: "^5.7.0",
    },
    packageManager: packageManager === "pnpm" ? "pnpm@9.15.0" : undefined,
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
        outputs: [".next/**", "!.next/cache/**", "dist/**"],
      },
      dev: {
        cache: false,
        persistent: true,
      },
      lint: {
        dependsOn: ["^lint"],
      },
    },
  };

  // Shared package
  const sharedPackageJson = {
    name: "@repo/shared",
    version: "0.1.0",
    private: true,
    main: "./src/index.ts",
    types: "./src/index.ts",
  };

  const sharedIndex = `// Shared utilities and types
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
`;

  // Config packages
  const configTsPackageJson = {
    name: "@repo/config-typescript",
    version: "0.1.0",
    private: true,
  };

  const baseJson = {
    $schema: "https://json.schemastore.org/tsconfig",
    compilerOptions: {
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      moduleResolution: "bundler",
      module: "ESNext",
      target: "ES2022",
    },
  };

  const gitignore = `node_modules
.next
.turbo
dist
.env
.env.local
.DS_Store
`;

  await Promise.all([
    Bun.write(
      join(projectPath, "package.json"),
      JSON.stringify(rootPackageJson, null, 2),
    ),
    Bun.write(join(projectPath, "pnpm-workspace.yaml"), workspaceYaml),
    Bun.write(
      join(projectPath, "turbo.json"),
      JSON.stringify(turboJson, null, 2),
    ),
    Bun.write(
      join(projectPath, "packages/shared/package.json"),
      JSON.stringify(sharedPackageJson, null, 2),
    ),
    Bun.write(join(projectPath, "packages/shared/src/index.ts"), sharedIndex),
    Bun.write(
      join(projectPath, "packages/config-typescript/package.json"),
      JSON.stringify(configTsPackageJson, null, 2),
    ),
    Bun.write(
      join(projectPath, "packages/config-typescript/base.json"),
      JSON.stringify(baseJson, null, 2),
    ),
    Bun.write(join(projectPath, ".gitignore"), gitignore),
  ]);
}
