/**
 * clean command - Remove build artifacts and caches
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { existsSync, statSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { findProjectYaml } from "../lib/project-yaml.js";
import * as ui from "../ui/theme.js";

interface CleanableItem {
  name: string;
  path: string;
  size: number;
  type: "cache" | "deps" | "build" | "logs";
  description: string;
}

export const cleanCommand = new Command("clean")
  .description("Clean build artifacts, caches, and dependencies")
  .option("-a, --all", "Clean everything without prompting")
  .option("--deps", "Only remove node_modules")
  .option("--cache", "Only remove caches (.next/cache, .turbo)")
  .option("--build", "Only remove build outputs (dist, .next, .expo)")
  .option("--dry-run", "Show what would be deleted")
  .option("-y, --yes", "Skip confirmation")
  .action(async (options) => {
    console.log();
    console.log(chalk.cyan.bold("  DevKitX - Clean Project"));
    console.log(chalk.gray("  " + "─".repeat(40)));
    console.log();

    // Find project root
    console.log(chalk.gray("  Finding project..."));
    const yamlPath = findProjectYaml();
    const projectPath = yamlPath
      ? yamlPath.replace(/[/\\]project\.yaml$/, "")
      : existsSync(join(process.cwd(), "package.json"))
        ? process.cwd()
        : null;

    if (!projectPath) {
      ui.error("Not in a project directory");
      return;
    }

    console.log(chalk.green(`  ✓ Found project: ${chalk.white(projectPath)}`));
    console.log();

    // Find cleanable items
    console.log(chalk.gray("  Scanning for cleanable items..."));
    const items = await findCleanableItems(projectPath);

    if (items.length === 0) {
      console.log(chalk.green("  ✓ Project is already clean!"));
      return;
    }

    // Filter by type if specific options provided
    let filteredItems = items;
    if (options.deps || options.cache || options.build) {
      filteredItems = items.filter((item) => {
        if (options.deps && item.type === "deps") return true;
        if (options.cache && item.type === "cache") return true;
        if (options.build && item.type === "build") return true;
        return false;
      });
    }

    if (filteredItems.length === 0) {
      console.log(chalk.green("  ✓ Nothing to clean for selected options"));
      return;
    }

    // Calculate totals
    const totalSize = filteredItems.reduce((sum, item) => sum + item.size, 0);

    console.log(
      chalk.green(`  ✓ Found ${filteredItems.length} item(s) to clean`),
    );
    console.log();

    // Display items
    console.log(chalk.white.bold("  Items to clean:"));
    console.log();

    for (const item of filteredItems) {
      const sizeStr = formatSize(item.size).padStart(10);
      const typeIcon = getTypeIcon(item.type);
      console.log(
        `    ${typeIcon} ${chalk.white(item.name.padEnd(25))} ${chalk.cyan(sizeStr)}`,
      );
      console.log(chalk.gray(`       ${item.description}`));
    }

    console.log();
    console.log(
      chalk.white(`  Total: ${chalk.cyan.bold(formatSize(totalSize))}`),
    );
    console.log();

    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.yellow("  [DRY RUN] No files were deleted."));
      return;
    }

    // Confirm unless --all or --yes
    if (!options.all && !options.yes) {
      const shouldClean = await p.confirm({
        message: `Delete ${filteredItems.length} item(s) (${formatSize(totalSize)})?`,
      });

      if (p.isCancel(shouldClean) || !shouldClean) {
        p.cancel("Clean cancelled");
        return;
      }
    }

    // Clean items
    console.log();
    console.log(chalk.cyan("  Cleaning..."));

    let cleaned = 0;
    let freedSpace = 0;

    for (const item of filteredItems) {
      try {
        console.log(chalk.gray(`    Removing ${item.name}...`));
        rmSync(item.path, { recursive: true, force: true });
        cleaned++;
        freedSpace += item.size;
        console.log(chalk.green(`    ✓ Removed ${item.name}`));
      } catch (error) {
        console.log(chalk.red(`    ✗ Failed to remove ${item.name}`));
      }
    }

    console.log();
    console.log(
      chalk.green.bold(
        `  ✓ Cleaned ${cleaned} item(s), freed ${formatSize(freedSpace)}`,
      ),
    );

    if (filteredItems.some((i) => i.type === "deps")) {
      console.log();
      console.log(chalk.gray("  Run 'pnpm install' to reinstall dependencies"));
    }
  });

/**
 * Find all cleanable items in a project
 */
async function findCleanableItems(
  projectPath: string,
): Promise<CleanableItem[]> {
  const items: CleanableItem[] = [];

  const cleanableDirs: Array<{
    name: string;
    type: CleanableItem["type"];
    description: string;
  }> = [
    // Dependencies
    { name: "node_modules", type: "deps", description: "Node.js dependencies" },
    {
      name: ".pnpm-store",
      type: "deps",
      description: "pnpm global store link",
    },

    // Build outputs
    { name: ".next", type: "build", description: "Next.js build output" },
    { name: "dist", type: "build", description: "Build distribution" },
    { name: "build", type: "build", description: "Build output" },
    { name: ".expo", type: "build", description: "Expo build cache" },
    { name: ".output", type: "build", description: "Nuxt/Nitro output" },

    // Caches
    { name: ".turbo", type: "cache", description: "Turborepo cache" },
    { name: ".cache", type: "cache", description: "General cache" },
    { name: ".parcel-cache", type: "cache", description: "Parcel cache" },
    { name: ".vite", type: "cache", description: "Vite cache" },
    { name: ".convex", type: "cache", description: "Convex local state" },

    // Logs
    { name: "*.log", type: "logs", description: "Log files" },
  ];

  // Check root directory
  for (const dir of cleanableDirs) {
    if (dir.name.includes("*")) continue; // Skip glob patterns for now

    const fullPath = join(projectPath, dir.name);
    if (existsSync(fullPath)) {
      const size = await getDirSize(fullPath);
      items.push({
        name: dir.name,
        path: fullPath,
        size,
        type: dir.type,
        description: dir.description,
      });
    }
  }

  // Check in apps/* and packages/* for monorepos
  const subDirs = ["apps", "packages"];
  for (const subDir of subDirs) {
    const subDirPath = join(projectPath, subDir);
    if (!existsSync(subDirPath)) continue;

    try {
      const entries = readdirSync(subDirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const appPath = join(subDirPath, entry.name);
        for (const dir of cleanableDirs) {
          if (dir.name.includes("*")) continue;

          const fullPath = join(appPath, dir.name);
          if (existsSync(fullPath)) {
            const size = await getDirSize(fullPath);
            items.push({
              name: `${subDir}/${entry.name}/${dir.name}`,
              path: fullPath,
              size,
              type: dir.type,
              description: `${dir.description} in ${entry.name}`,
            });
          }
        }
      }
    } catch {
      // Skip if can't read
    }
  }

  // Sort by size (largest first)
  items.sort((a, b) => b.size - a.size);

  return items;
}

/**
 * Get directory size recursively
 */
async function getDirSize(dirPath: string): Promise<number> {
  let size = 0;

  try {
    const stats = statSync(dirPath);
    if (stats.isFile()) {
      return stats.size;
    }

    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          size += await getDirSize(entryPath);
        } else if (entry.isFile()) {
          size += statSync(entryPath).size;
        }
      } catch {
        // Skip files we can't access
      }
    }
  } catch {
    // Skip directories we can't access
  }

  return size;
}

/**
 * Format bytes to human readable
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Get icon for item type
 */
function getTypeIcon(type: CleanableItem["type"]): string {
  switch (type) {
    case "deps":
      return chalk.blue("◆");
    case "build":
      return chalk.yellow("◆");
    case "cache":
      return chalk.cyan("◆");
    case "logs":
      return chalk.gray("◆");
    default:
      return "◆";
  }
}
