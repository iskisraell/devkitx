/**
 * list command - Find and display DevKitX projects
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join, basename } from "path";
import { parse } from "yaml";
import * as ui from "../ui/theme.js";

interface ProjectInfo {
  name: string;
  path: string;
  template: string;
  backend: string;
  lastModified: Date;
  hasNodeModules: boolean;
  isGitRepo: boolean;
}

// Common project locations to search
const SEARCH_PATHS = [
  "Documents",
  "Documents/Projects",
  "Documents/Local Projects",
  "Projects",
  "projects",
  "dev",
  "Development",
  "Code",
  "code",
  "repos",
  "GitHub",
  "Desktop",
];

export const listCommand = new Command("list")
  .description("Find and list all DevKitX projects")
  .option("-p, --path <path>", "Search in specific directory")
  .option(
    "-a, --all",
    "Include non-DevKitX projects (any project with package.json)",
  )
  .option("--json", "Output as JSON")
  .option("-d, --depth <depth>", "Search depth (default: 2)", "2")
  .action(async (options) => {
    console.log();

    if (!options.json) {
      console.log(chalk.cyan.bold("  DevKitX Projects"));
      console.log(chalk.gray("  " + "─".repeat(50)));
      console.log();
      console.log(chalk.gray("  Searching for projects..."));
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const searchDepth = parseInt(options.depth, 10) || 2;
    const projects: ProjectInfo[] = [];

    // Determine search paths
    let pathsToSearch: string[] = [];

    if (options.path) {
      pathsToSearch = [options.path];
    } else {
      pathsToSearch = SEARCH_PATHS.map((p) => join(homeDir, p)).filter((p) =>
        existsSync(p),
      );
      // Also add current directory
      pathsToSearch.unshift(process.cwd());
    }

    // Search for projects
    for (const searchPath of pathsToSearch) {
      await findProjects(searchPath, projects, searchDepth, options.all);
    }

    // Remove duplicates by path
    const uniqueProjects = projects.filter(
      (project, index, self) =>
        index === self.findIndex((p) => p.path === project.path),
    );

    // Sort by last modified (most recent first)
    uniqueProjects.sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
    );

    if (!options.json) {
      console.log(chalk.green(`  ✓ Found ${uniqueProjects.length} project(s)`));
      console.log();
    }

    if (uniqueProjects.length === 0) {
      if (!options.json) {
        console.log(chalk.gray("  No projects found."));
        console.log();
        console.log(chalk.gray("  Create a new project with:"));
        console.log(chalk.cyan("    dx create my-app"));
      } else {
        console.log("[]");
      }
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(uniqueProjects, null, 2));
      return;
    }

    // Display projects in a nice table
    const maxNameLen = Math.min(
      25,
      Math.max(...uniqueProjects.map((p) => p.name.length)),
    );
    const maxTemplateLen = Math.max(
      ...uniqueProjects.map((p) => p.template.length),
    );

    for (const project of uniqueProjects) {
      const name = project.name.padEnd(maxNameLen);
      const template = project.template.padEnd(maxTemplateLen);
      const timeAgo = formatTimeAgo(project.lastModified);

      // Status indicators
      const gitIcon = project.isGitRepo ? chalk.green("●") : chalk.gray("○");
      const depsIcon = project.hasNodeModules
        ? chalk.green("●")
        : chalk.yellow("○");

      console.log(
        `  ${chalk.white.bold(name)}  ` +
          `${chalk.cyan(template)}  ` +
          `${chalk.gray(timeAgo.padEnd(12))}  ` +
          `${gitIcon} ${depsIcon}`,
      );
      console.log(chalk.gray(`    ${shortenPath(project.path)}`));
      console.log();
    }

    // Legend
    console.log(chalk.gray("  " + "─".repeat(50)));
    console.log(
      chalk.gray("  Legend: ") +
        chalk.green("●") +
        chalk.gray(" git/deps  ") +
        chalk.yellow("○") +
        chalk.gray(" no deps  ") +
        chalk.gray("○") +
        chalk.gray(" no git"),
    );
    console.log();
    console.log(chalk.gray("  Quick actions:"));
    console.log(
      chalk.gray("    dx go <name>     ") + chalk.gray("Switch to project"),
    );
    console.log(
      chalk.gray("    dx status        ") + chalk.gray("Check current project"),
    );
    console.log(
      chalk.gray("    dx open          ") + chalk.gray("Open in editor"),
    );
    console.log();
  });

/**
 * Recursively find projects in a directory
 */
async function findProjects(
  dir: string,
  projects: ProjectInfo[],
  depth: number,
  includeAll: boolean,
): Promise<void> {
  if (depth < 0) return;
  if (!existsSync(dir)) return;

  try {
    // Check if this directory is a project
    const hasProjectYaml = existsSync(join(dir, "project.yaml"));
    const hasPackageJson = existsSync(join(dir, "package.json"));

    if (hasProjectYaml || (includeAll && hasPackageJson)) {
      const projectInfo = await getProjectInfo(dir, hasProjectYaml);
      if (projectInfo) {
        projects.push(projectInfo);
      }
      // Don't search subdirectories of a project
      return;
    }

    // Search subdirectories
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden directories and common non-project directories
      if (entry.name.startsWith(".")) continue;
      if (
        ["node_modules", "dist", ".next", ".turbo", "build"].includes(
          entry.name,
        )
      )
        continue;

      if (entry.isDirectory()) {
        const subPath = join(dir, entry.name);
        await findProjects(subPath, projects, depth - 1, includeAll);
      }
    }
  } catch {
    // Skip directories we can't access
  }
}

/**
 * Get project information from a directory
 */
async function getProjectInfo(
  dir: string,
  hasProjectYaml: boolean,
): Promise<ProjectInfo | null> {
  try {
    const stats = statSync(dir);
    const name = basename(dir);

    let template = "unknown";
    let backend = "none";

    if (hasProjectYaml) {
      try {
        const yamlContent = readFileSync(join(dir, "project.yaml"), "utf-8");
        const config = parse(yamlContent);

        if (config.stack?.monorepo) {
          template = "turbo-monorepo";
        } else if (config.stack?.apps?.web?.framework) {
          const framework = config.stack.apps.web.framework;
          if (framework.includes("next")) template = "next-only";
          else if (framework.includes("vite")) template = "vite-only";
        }

        if (config.stack?.backend?.primary) {
          backend = config.stack.backend.primary;
        }
      } catch {
        template = "devkitx";
      }
    } else {
      // Try to detect from package.json
      try {
        const pkgJson = JSON.parse(
          readFileSync(join(dir, "package.json"), "utf-8"),
        );
        if (pkgJson.dependencies?.next || pkgJson.devDependencies?.next) {
          template = "next.js";
        } else if (pkgJson.devDependencies?.vite) {
          template = "vite";
        } else if (pkgJson.dependencies?.expo) {
          template = "expo";
        } else if (pkgJson.workspaces || existsSync(join(dir, "turbo.json"))) {
          template = "monorepo";
        } else {
          template = "node";
        }
      } catch {
        template = "node";
      }
    }

    return {
      name,
      path: dir,
      template,
      backend,
      lastModified: stats.mtime,
      hasNodeModules: existsSync(join(dir, "node_modules")),
      isGitRepo: existsSync(join(dir, ".git")),
    };
  } catch {
    return null;
  }
}

/**
 * Format a date as relative time
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

/**
 * Shorten a path for display
 */
function shortenPath(fullPath: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (fullPath.startsWith(homeDir)) {
    return "~" + fullPath.slice(homeDir.length).replace(/\\/g, "/");
  }
  return fullPath.replace(/\\/g, "/");
}
