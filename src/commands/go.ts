/**
 * go command - Quick project switcher
 *
 * This command writes the selected path to a temp file that the PowerShell
 * wrapper reads to actually change directories (subprocesses cannot change
 * the parent shell's working directory directly).
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { join, basename, dirname } from "path";
import { parse } from "yaml";
import * as ui from "../ui/theme.js";

// Temp file for shell integration
const GO_PATH_FILE = join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".devkitx",
  "go-path.txt",
);

interface ProjectInfo {
  name: string;
  path: string;
  template: string;
  lastModified: Date;
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

export const goCommand = new Command("go")
  .description("Switch to a project directory")
  .argument("[name]", "Project name to switch to")
  .option("--path-only", "Output only the path (for shell integration)")
  .option("-l, --list", "List recent projects")
  .action(async (name: string | undefined, options) => {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";

    // Find all projects
    const projects = await findAllProjects(homeDir);

    if (projects.length === 0) {
      if (!options.pathOnly) {
        ui.error("No DevKitX projects found");
        console.log(chalk.gray("  Create a project with: dx create my-app"));
      }
      return;
    }

    // List mode
    if (options.list) {
      console.log();
      console.log(chalk.cyan.bold("  Recent Projects"));
      console.log(chalk.gray("  " + "─".repeat(40)));
      console.log();

      // Sort by last modified
      projects.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );

      const recentProjects = projects.slice(0, 10);
      for (let i = 0; i < recentProjects.length; i++) {
        const p = recentProjects[i];
        const num = chalk.gray(`${i + 1}.`);
        const timeAgo = formatTimeAgo(p.lastModified);
        console.log(
          `  ${num} ${chalk.white.bold(p.name.padEnd(25))} ${chalk.gray(timeAgo)}`,
        );
      }

      console.log();
      console.log(chalk.gray("  Usage: dx go <name>"));
      console.log();
      return;
    }

    let selectedProject: ProjectInfo | undefined;

    if (name) {
      // Find by name (fuzzy match)
      const lowerName = name.toLowerCase();

      // Exact match first
      selectedProject = projects.find(
        (p) => p.name.toLowerCase() === lowerName,
      );

      // Then starts with
      if (!selectedProject) {
        selectedProject = projects.find((p) =>
          p.name.toLowerCase().startsWith(lowerName),
        );
      }

      // Then contains
      if (!selectedProject) {
        selectedProject = projects.find((p) =>
          p.name.toLowerCase().includes(lowerName),
        );
      }

      if (!selectedProject) {
        if (!options.pathOnly) {
          ui.error(`Project not found: ${name}`);
          console.log();

          // Suggest similar
          const similar = projects.filter((p) =>
            p.name.toLowerCase().includes(lowerName.slice(0, 3)),
          );
          if (similar.length > 0) {
            console.log(chalk.gray("  Did you mean:"));
            for (const p of similar.slice(0, 5)) {
              console.log(`    ${chalk.cyan(p.name)}`);
            }
            console.log();
          }
        }
        return;
      }
    } else {
      // Interactive selection
      if (options.pathOnly) {
        // Can't do interactive in path-only mode
        return;
      }

      console.log();
      console.log(chalk.cyan.bold("  Project Switcher"));
      console.log(chalk.gray("  " + "─".repeat(40)));
      console.log();

      // Sort by last modified
      projects.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );

      const choices = projects.slice(0, 20).map((p) => ({
        value: p,
        label: p.name,
        hint: `${p.template} - ${formatTimeAgo(p.lastModified)}`,
      }));

      const selection = await p.select({
        message: "Select a project:",
        options: choices,
      });

      if (p.isCancel(selection)) {
        p.cancel("Cancelled");
        return;
      }

      selectedProject = selection as ProjectInfo;
    }

    // Output the path
    if (options.pathOnly) {
      // Just output the path for shell integration
      console.log(selectedProject.path);
    } else {
      // Write path to temp file for PowerShell wrapper to read
      try {
        mkdirSync(dirname(GO_PATH_FILE), { recursive: true });
        writeFileSync(GO_PATH_FILE, selectedProject.path, "utf-8");
      } catch {
        // Ignore write errors
      }

      console.log();
      console.log(
        chalk.green(`  -> ${chalk.white.bold(selectedProject.name)}`),
      );
      console.log(chalk.gray(`     ${selectedProject.path}`));
      console.log();
    }
  });

/**
 * Find all DevKitX projects
 */
async function findAllProjects(homeDir: string): Promise<ProjectInfo[]> {
  const projects: ProjectInfo[] = [];
  const searchDepth = 2;

  // Determine search paths
  const pathsToSearch = SEARCH_PATHS.map((p) => join(homeDir, p)).filter((p) =>
    existsSync(p),
  );

  // Search for projects
  for (const searchPath of pathsToSearch) {
    await findProjectsInDir(searchPath, projects, searchDepth);
  }

  // Remove duplicates by path
  const uniqueProjects = projects.filter(
    (project, index, self) =>
      index === self.findIndex((p) => p.path === project.path),
  );

  return uniqueProjects;
}

/**
 * Recursively find projects in a directory
 */
async function findProjectsInDir(
  dir: string,
  projects: ProjectInfo[],
  depth: number,
): Promise<void> {
  if (depth < 0) return;
  if (!existsSync(dir)) return;

  try {
    // Check if this directory is a DevKitX project
    const hasProjectYaml = existsSync(join(dir, "project.yaml"));

    if (hasProjectYaml) {
      const projectInfo = await getProjectInfo(dir);
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
        await findProjectsInDir(subPath, projects, depth - 1);
      }
    }
  } catch {
    // Skip directories we can't access
  }
}

/**
 * Get project information from a directory
 */
async function getProjectInfo(dir: string): Promise<ProjectInfo | null> {
  try {
    const stats = statSync(dir);
    const name = basename(dir);

    let template = "devkitx";

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
    } catch {
      template = "devkitx";
    }

    return {
      name,
      path: dir,
      template,
      lastModified: stats.mtime,
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
