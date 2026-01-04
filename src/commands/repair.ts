/**
 * repair command - Fix incomplete project installations
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { findProjectYaml, readProjectConfig } from "../lib/project-yaml.js";
import { logger } from "../lib/logger.js";
import * as ui from "../ui/theme.js";

interface RepairIssue {
  type:
    | "missing_package"
    | "missing_file"
    | "missing_directory"
    | "install_failed";
  path: string;
  description: string;
  fix: () => Promise<void>;
}

export const repairCommand = new Command("repair")
  .description("Repair incomplete project setup or resume failed installation")
  .option("-v, --verbose", "Show detailed logging")
  .option("--skip-install", "Skip reinstalling dependencies")
  .option("-y, --yes", "Skip confirmation prompts")
  .action(
    async (options: {
      verbose?: boolean;
      skipInstall?: boolean;
      yes?: boolean;
    }) => {
      console.log();
      p.intro(chalk.bgYellow(chalk.black(" DevKitX - Repair Project ")));

      // Immediate feedback
      console.log(chalk.gray("  Initializing repair process..."));

      logger.setVerbose(options.verbose ?? false);

      // Find project with feedback
      console.log(chalk.gray("  Looking for project.yaml..."));
      const yamlPath = findProjectYaml();

      if (!yamlPath) {
        ui.error(
          "No project.yaml found. This doesn't appear to be a DevKitX project.",
        );
        console.log();
        console.log(
          "Run",
          chalk.cyan("dx create <name>"),
          "to create a new project",
        );
        return;
      }

      console.log(chalk.green("  ✓ Found project.yaml"));

      const projectPath = yamlPath.replace(/[/\\]project\.yaml$/, "");

      // Initialize logger
      console.log(chalk.gray("  Initializing logger..."));
      try {
        logger.init(projectPath);
      } catch {
        // Logger init failure is not critical
      }
      logger.info("Starting repair process", { projectPath });
      console.log(chalk.green("  ✓ Logger initialized"));

      // Read config with feedback
      console.log(chalk.gray("  Reading project configuration..."));
      const config = await readProjectConfig(yamlPath);
      if (!config) {
        ui.error("Failed to read project.yaml");
        return;
      }
      console.log(chalk.green("  ✓ Configuration loaded"));

      // Scan for issues
      console.log(chalk.gray("  Scanning for issues..."));
      const issues: RepairIssue[] = [];
      const isMonorepo = config.stack.monorepo === "turborepo";

      try {
        if (isMonorepo) {
          console.log(chalk.gray("    Checking monorepo packages..."));
          await scanMonorepoIssues(projectPath, config, issues);
        } else {
          console.log(chalk.gray("    Checking standalone project..."));
          await scanStandaloneIssues(projectPath, config, issues);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        ui.error(`Scan failed: ${errorMessage}`);
        return;
      }

      console.log(
        chalk.green(`  ✓ Scan complete - Found ${issues.length} issue(s)`),
      );
      console.log();

      if (issues.length === 0) {
        ui.success("No issues found! Project appears to be correctly set up.");
        p.outro(chalk.green("Project is healthy!"));
        return;
      }

      // Display issues
      ui.header("Issues Found");
      for (const issue of issues) {
        console.log(`  ${chalk.red("●")} ${issue.description}`);
        console.log(`    ${chalk.gray(issue.path)}`);
      }
      console.log();

      // Confirm fix
      let shouldFix = options.yes;
      if (!shouldFix) {
        const confirmResult = await p.confirm({
          message: `Fix ${issues.length} issue(s)?`,
        });

        if (p.isCancel(confirmResult)) {
          p.cancel("Repair cancelled");
          return;
        }
        shouldFix = confirmResult;
      }

      if (!shouldFix) {
        p.cancel("Repair cancelled");
        return;
      }

      // Fix issues with progress
      console.log();
      console.log(chalk.cyan("Fixing issues..."));
      let fixed = 0;
      let failed = 0;

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        const progress = `[${i + 1}/${issues.length}]`;

        console.log(
          chalk.gray(`  ${progress} Fixing: ${issue.description}...`),
        );

        try {
          logger.step(`Fixing: ${issue.description}`);
          await issue.fix();
          logger.stepComplete(issue.description);
          console.log(
            chalk.green(`  ${progress} ✓ Fixed: ${issue.description}`),
          );
          fixed++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.stepFailed(issue.description, error);
          console.log(
            chalk.red(`  ${progress} ✗ Failed: ${issue.description}`),
          );
          if (options.verbose) {
            console.log(chalk.red(`      Error: ${errorMessage}`));
          }
          failed++;
        }
      }

      console.log();
      console.log(
        chalk.cyan(
          `Fixed ${fixed} issue(s)${failed > 0 ? `, ${failed} failed` : ""}`,
        ),
      );

      // Reinstall dependencies if needed
      if (
        !options.skipInstall &&
        issues.some(
          (i) => i.type === "missing_package" || i.type === "install_failed",
        )
      ) {
        console.log();
        console.log(chalk.cyan("Reinstalling dependencies..."));
        console.log(chalk.gray("  This may take a few minutes..."));

        try {
          const installProc = Bun.spawn(["pnpm", "install"], {
            cwd: projectPath,
            stdout: "inherit",
            stderr: "inherit",
          });

          const exitCode = await installProc.exited;

          if (exitCode === 0) {
            console.log(chalk.green("  ✓ Dependencies installed successfully"));
            logger.success("pnpm install completed");
          } else {
            console.log(chalk.yellow("  ! Dependency installation had issues"));
            console.log(
              chalk.gray("    Run 'pnpm install' manually to see details"),
            );
            logger.error("pnpm install failed");
          }
        } catch (error) {
          console.log(chalk.red("  ✗ Failed to run pnpm install"));
          logger.error("pnpm install error", error);
        }
      }

      console.log();
      if (failed === 0) {
        p.outro(chalk.green("Project repaired successfully!"));
      } else {
        p.outro(
          chalk.yellow(`Repair completed with ${failed} issue(s) remaining`),
        );
        console.log();
        console.log(chalk.gray("Check the log file for details:"));
        console.log(
          chalk.gray(`  ${join(projectPath, ".devkitx", "setup.log")}`),
        );
      }
    },
  );

async function scanMonorepoIssues(
  projectPath: string,
  config: any,
  issues: RepairIssue[],
): Promise<void> {
  // Check required packages
  const requiredPackages = [
    {
      name: "@repo/shared",
      path: "packages/shared",
      files: ["package.json", "src/index.ts"],
    },
    {
      name: "@repo/ui",
      path: "packages/ui",
      files: ["package.json", "src/index.ts"],
    },
    {
      name: "@repo/config-typescript",
      path: "packages/config-typescript",
      files: ["package.json", "base.json"],
    },
    {
      name: "@repo/config-tailwind",
      path: "packages/config-tailwind",
      files: ["package.json", "tailwind.config.ts"],
    },
  ];

  for (const pkg of requiredPackages) {
    const pkgPath = join(projectPath, pkg.path);

    if (!existsSync(pkgPath)) {
      issues.push({
        type: "missing_directory",
        path: pkg.path,
        description: `Missing package directory: ${pkg.name}`,
        fix: async () => {
          mkdirSync(pkgPath, { recursive: true });
          await createPackageFiles(projectPath, pkg.name, pkg.path);
        },
      });
    } else {
      // Check individual files
      for (const file of pkg.files) {
        const filePath = join(pkgPath, file);
        if (!existsSync(filePath)) {
          issues.push({
            type: "missing_file",
            path: join(pkg.path, file),
            description: `Missing file in ${pkg.name}: ${file}`,
            fix: async () => {
              await createPackageFiles(projectPath, pkg.name, pkg.path);
            },
          });
        }
      }
    }
  }

  // Check apps
  const apps = ["apps/web", "apps/mobile"];
  for (const appPath of apps) {
    const fullPath = join(projectPath, appPath);
    if (existsSync(fullPath) && !existsSync(join(fullPath, "package.json"))) {
      issues.push({
        type: "missing_file",
        path: join(appPath, "package.json"),
        description: `Missing package.json in ${appPath}`,
        fix: async () => {
          logger.warn(
            `Cannot auto-fix ${appPath}/package.json - manual intervention may be required`,
          );
        },
      });
    }
  }

  // Check for node_modules
  if (!existsSync(join(projectPath, "node_modules"))) {
    issues.push({
      type: "install_failed",
      path: "node_modules",
      description: "Dependencies not installed",
      fix: async () => {
        // Will be handled by the install step
      },
    });
  }
}

async function scanStandaloneIssues(
  projectPath: string,
  config: any,
  issues: RepairIssue[],
): Promise<void> {
  // Check for package.json
  if (!existsSync(join(projectPath, "package.json"))) {
    issues.push({
      type: "missing_file",
      path: "package.json",
      description: "Missing package.json",
      fix: async () => {
        logger.warn(
          "Cannot auto-fix package.json - manual intervention required",
        );
      },
    });
  }

  // Check for node_modules
  if (!existsSync(join(projectPath, "node_modules"))) {
    issues.push({
      type: "install_failed",
      path: "node_modules",
      description: "Dependencies not installed",
      fix: async () => {
        // Will be handled by the install step
      },
    });
  }
}

async function createPackageFiles(
  projectPath: string,
  packageName: string,
  packagePath: string,
): Promise<void> {
  const fullPath = join(projectPath, packagePath);
  mkdirSync(fullPath, { recursive: true });

  switch (packageName) {
    case "@repo/config-typescript":
      await createConfigTypescriptPackage(fullPath);
      break;
    case "@repo/config-tailwind":
      await createConfigTailwindPackage(fullPath);
      break;
    case "@repo/ui":
      await createUiPackage(fullPath);
      break;
    case "@repo/shared":
      await createSharedPackage(fullPath);
      break;
  }
}

async function createConfigTypescriptPackage(pkgPath: string): Promise<void> {
  const packageJson = {
    name: "@repo/config-typescript",
    version: "0.1.0",
    private: true,
    license: "MIT",
    publishConfig: { access: "public" },
  };

  const baseJson = {
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

  const nextJson = {
    $schema: "https://json.schemastore.org/tsconfig",
    extends: "./base.json",
    compilerOptions: {
      lib: ["dom", "dom.iterable", "ES2022"],
      jsx: "preserve",
      noEmit: true,
      plugins: [{ name: "next" }],
    },
  };

  const reactLibraryJson = {
    $schema: "https://json.schemastore.org/tsconfig",
    extends: "./base.json",
    compilerOptions: {
      lib: ["dom", "dom.iterable", "ES2022"],
      jsx: "react-jsx",
    },
  };

  await Promise.all([
    Bun.write(
      join(pkgPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    ),
    Bun.write(join(pkgPath, "base.json"), JSON.stringify(baseJson, null, 2)),
    Bun.write(join(pkgPath, "nextjs.json"), JSON.stringify(nextJson, null, 2)),
    Bun.write(
      join(pkgPath, "react-library.json"),
      JSON.stringify(reactLibraryJson, null, 2),
    ),
  ]);
}

async function createConfigTailwindPackage(pkgPath: string): Promise<void> {
  const packageJson = {
    name: "@repo/config-tailwind",
    version: "0.1.0",
    private: true,
    exports: { ".": "./tailwind.config.ts" },
    devDependencies: { tailwindcss: "^3.4.0" },
  };

  const tailwindConfig = `import type { Config } from "tailwindcss";

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
      },
    },
  },
  plugins: [],
};

export default config;
`;

  await Promise.all([
    Bun.write(
      join(pkgPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    ),
    Bun.write(join(pkgPath, "tailwind.config.ts"), tailwindConfig),
  ]);
}

async function createUiPackage(pkgPath: string): Promise<void> {
  mkdirSync(join(pkgPath, "src"), { recursive: true });

  const packageJson = {
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

  const indexTs = `// Shared UI components

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
`;

  const tsconfig = {
    extends: "@repo/config-typescript/react-library.json",
    compilerOptions: { outDir: "./dist", rootDir: "./src" },
    include: ["src"],
    exclude: ["node_modules", "dist"],
  };

  await Promise.all([
    Bun.write(
      join(pkgPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    ),
    Bun.write(join(pkgPath, "src/index.ts"), indexTs),
    Bun.write(
      join(pkgPath, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2),
    ),
  ]);
}

async function createSharedPackage(pkgPath: string): Promise<void> {
  mkdirSync(join(pkgPath, "src/types"), { recursive: true });
  mkdirSync(join(pkgPath, "src/utils"), { recursive: true });

  const packageJson = {
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
      "@repo/config-typescript": "workspace:*",
      typescript: "^5.7.0",
    },
  };

  const indexTs = `export * from "./types";
export * from "./utils";
`;

  const typesIndex = `export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}
`;

  const utilsIndex = `export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
`;

  const tsconfig = {
    extends: "@repo/config-typescript/base.json",
    compilerOptions: { outDir: "./dist", rootDir: "./src" },
    include: ["src"],
    exclude: ["node_modules", "dist"],
  };

  await Promise.all([
    Bun.write(
      join(pkgPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    ),
    Bun.write(join(pkgPath, "src/index.ts"), indexTs),
    Bun.write(join(pkgPath, "src/types/index.ts"), typesIndex),
    Bun.write(join(pkgPath, "src/utils/index.ts"), utilsIndex),
    Bun.write(
      join(pkgPath, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2),
    ),
  ]);
}
