/**
 * delete command - Safely delete DevKitX projects
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import {
  existsSync,
  readdirSync,
  statSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "fs";
import { join, basename, dirname } from "path";
import { parse } from "yaml";
import { findProjectYaml, readProjectConfig } from "../lib/project-yaml.js";
import { logger } from "../lib/logger.js";
import * as ui from "../ui/theme.js";

// Store for undo functionality (session-based)
const UNDO_FILE = join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".devkitx",
  "last-deleted.json",
);

interface DeletedProject {
  name: string;
  originalPath: string;
  backupPath: string;
  deletedAt: string;
}

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

export const deleteCommand = new Command("delete")
  .description("Safely delete a DevKitX project")
  .argument("[path]", "Path or name of project to delete")
  .option("--dry-run", "Preview what will be deleted without actually deleting")
  .option("--backup", "Create a backup before deleting (default: prompted)")
  .option("--no-backup", "Skip backup creation")
  .option("-y, --yes", "Skip backup prompt (still requires type-to-confirm)")
  .option("--force", "Skip all confirmations (dangerous, requires --yes)")
  .action(async (pathArg: string | undefined, options) => {
    console.log();
    p.intro(chalk.bgRed(chalk.white(" DevKitX - Delete Project ")));

    let projectPath: string;

    // If no path specified, show interactive picker
    if (!pathArg) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || "";

      console.log(chalk.gray("  Searching for projects..."));
      const projects = await findAllProjects(homeDir);

      if (projects.length === 0) {
        ui.error("No DevKitX projects found");
        console.log(chalk.gray("  Create a project with: dx create my-app"));
        return;
      }

      console.log(chalk.green(`  ✓ Found ${projects.length} project(s)`));
      console.log();

      // Sort by last modified (most recent first)
      projects.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );

      const choices = projects.map((proj) => ({
        value: proj,
        label: proj.name,
        hint: `${proj.template} - ${shortenPath(proj.path)}`,
      }));

      const selection = await p.select({
        message: "Select a project to delete:",
        options: choices,
      });

      if (p.isCancel(selection)) {
        p.cancel("Cancelled");
        return;
      }

      projectPath = (selection as ProjectInfo).path;
    } else {
      // Check if it's an absolute path
      if (existsSync(pathArg)) {
        projectPath = pathArg;
      } else {
        // Try as relative path from cwd
        const relativePath = join(process.cwd(), pathArg);
        if (existsSync(relativePath)) {
          projectPath = relativePath;
        } else {
          // Try to find project by name
          const homeDir = process.env.HOME || process.env.USERPROFILE || "";
          console.log(chalk.gray(`  Searching for project "${pathArg}"...`));
          const projects = await findAllProjects(homeDir);

          const lowerName = pathArg.toLowerCase();
          let foundProject = projects.find(
            (p) => p.name.toLowerCase() === lowerName,
          );

          if (!foundProject) {
            foundProject = projects.find((p) =>
              p.name.toLowerCase().startsWith(lowerName),
            );
          }

          if (!foundProject) {
            foundProject = projects.find((p) =>
              p.name.toLowerCase().includes(lowerName),
            );
          }

          if (!foundProject) {
            ui.error(`Project not found: ${pathArg}`);
            console.log();
            console.log(
              chalk.gray("  Run 'dx list' to see available projects"),
            );
            return;
          }

          projectPath = foundProject.path;
          console.log(chalk.green(`  ✓ Found: ${foundProject.name}`));
        }
      }
    }

    // Validate it's a DevKitX project
    console.log(chalk.gray("  Validating project..."));
    const yamlPath = existsSync(join(projectPath, "project.yaml"))
      ? join(projectPath, "project.yaml")
      : null;

    if (!yamlPath) {
      // Check if it's at least a node project
      const hasPackageJson = existsSync(join(projectPath, "package.json"));
      if (!hasPackageJson) {
        ui.error(`Not a valid project: ${projectPath}`);
        console.log(chalk.gray("  No project.yaml or package.json found"));
        return;
      }
      console.log(
        chalk.yellow("  ! Not a DevKitX project, but found package.json"),
      );
    } else {
      console.log(chalk.green("  ✓ Valid DevKitX project"));
    }

    const projectName = basename(projectPath);

    // Check if user is inside the project directory (will cause EBUSY on Windows)
    const cwd = process.cwd();
    const normalizedCwd = cwd.toLowerCase().replace(/\\/g, "/");
    const normalizedProjectPath = projectPath.toLowerCase().replace(/\\/g, "/");

    if (
      normalizedCwd === normalizedProjectPath ||
      normalizedCwd.startsWith(normalizedProjectPath + "/")
    ) {
      ui.error("Cannot delete: You are inside this project directory!");
      console.log();
      console.log(chalk.gray("  Windows locks directories that are in use."));
      console.log(chalk.gray("  Please navigate out of the project first:"));
      console.log();
      console.log(chalk.cyan(`    cd ..`));
      console.log(chalk.cyan(`    dx delete ${projectName}`));
      console.log();
      return;
    }

    // Safety check: prevent deleting system/important directories
    const dangerousPaths = [
      process.env.HOME || "",
      process.env.USERPROFILE || "",
      "C:\\",
      "C:\\Windows",
      "C:\\Program Files",
      "/",
      "/home",
      "/usr",
    ].filter(Boolean);

    if (
      dangerousPaths.some(
        (dp) => projectPath.toLowerCase() === dp.toLowerCase(),
      )
    ) {
      ui.error("Cannot delete system or home directory!");
      return;
    }

    // Calculate what will be deleted
    console.log(chalk.gray("  Analyzing project contents..."));
    const stats = await analyzeDirectory(projectPath);
    console.log(chalk.green("  ✓ Analysis complete"));

    // Display what will be deleted
    console.log();
    console.log(chalk.bold.red("  ⚠ You are about to delete:"));
    console.log();
    console.log(`     Project:    ${chalk.white(projectName)}`);
    console.log(`     Location:   ${chalk.gray(projectPath)}`);
    console.log();
    console.log(`     ${chalk.cyan(stats.fileCount.toString())} files`);
    console.log(`     ${chalk.cyan(stats.dirCount.toString())} directories`);
    console.log(`     ${chalk.cyan(formatSize(stats.totalSize))} total`);

    if (stats.hasNodeModules) {
      console.log(
        `     ${chalk.yellow("(includes node_modules: " + formatSize(stats.nodeModulesSize) + ")")}`,
      );
    }
    console.log();

    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.cyan("  [DRY RUN] No files were deleted."));
      console.log(chalk.gray("  Remove --dry-run to actually delete."));
      p.outro(chalk.gray("Dry run complete"));
      return;
    }

    // Force mode (skip all prompts)
    if (options.force && options.yes) {
      console.log(chalk.yellow("  --force mode: Skipping all confirmations"));
    } else {
      // Type-to-confirm (like GitHub repo deletion)
      console.log(chalk.red.bold("  This action cannot be undone!"));
      console.log();

      const confirmName = await p.text({
        message: `Type "${projectName}" to confirm deletion:`,
        placeholder: projectName,
        validate: (value) => {
          if (value !== projectName) {
            return `Please type exactly: ${projectName}`;
          }
          return undefined;
        },
      });

      if (p.isCancel(confirmName)) {
        p.cancel("Deletion cancelled");
        return;
      }
    }

    // Backup prompt
    let shouldBackup = options.backup === true;
    if (!options.backup && options.backup !== false && !options.yes) {
      const backupChoice = await p.confirm({
        message: "Create a backup before deleting? (recommended)",
        initialValue: true,
      });

      if (p.isCancel(backupChoice)) {
        p.cancel("Deletion cancelled");
        return;
      }
      shouldBackup = backupChoice;
    }

    let backupPath = "";

    // Create backup if requested
    if (shouldBackup) {
      console.log();
      console.log(chalk.cyan("Creating backup..."));

      const backupDir = join(
        process.env.HOME || process.env.USERPROFILE || "",
        ".devkitx",
        "backups",
      );
      mkdirSync(backupDir, { recursive: true });

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      backupPath = join(backupDir, `${projectName}-${timestamp}.zip`);

      console.log(chalk.gray(`  Creating zip archive...`));

      try {
        // Use PowerShell to create zip (Windows)
        const zipProc = Bun.spawn(
          [
            "powershell",
            "-Command",
            `Compress-Archive -Path "${projectPath}\\*" -DestinationPath "${backupPath}" -Force`,
          ],
          { stdout: "pipe", stderr: "pipe" },
        );

        await zipProc.exited;

        if (existsSync(backupPath)) {
          const backupStats = statSync(backupPath);
          console.log(
            chalk.green(`  ✓ Backup created: ${formatSize(backupStats.size)}`),
          );
          console.log(chalk.gray(`    ${backupPath}`));
        } else {
          console.log(chalk.yellow("  ! Backup creation may have failed"));
        }
      } catch (error) {
        console.log(
          chalk.yellow("  ! Could not create backup, continuing anyway"),
        );
      }
    }

    // Delete the project
    console.log();
    console.log(chalk.cyan("Deleting project..."));

    try {
      // Delete node_modules first (usually the slowest)
      if (stats.hasNodeModules) {
        console.log(chalk.gray("  [1/3] Removing node_modules..."));
        const nodeModulesPath = join(projectPath, "node_modules");
        if (existsSync(nodeModulesPath)) {
          rmSync(nodeModulesPath, { recursive: true, force: true });
        }
        console.log(chalk.green("  [1/3] ✓ node_modules removed"));
      } else {
        console.log(chalk.gray("  [1/3] No node_modules to remove"));
      }

      // Delete build artifacts
      console.log(chalk.gray("  [2/3] Removing build artifacts..."));
      const buildDirs = [".next", ".turbo", "dist", ".expo", ".convex"];
      for (const dir of buildDirs) {
        const dirPath = join(projectPath, dir);
        if (existsSync(dirPath)) {
          rmSync(dirPath, { recursive: true, force: true });
        }
      }
      console.log(chalk.green("  [2/3] ✓ Build artifacts removed"));

      // Delete remaining files
      console.log(chalk.gray("  [3/3] Removing project files..."));
      rmSync(projectPath, { recursive: true, force: true });
      console.log(chalk.green("  [3/3] ✓ Project files removed"));

      // Save undo information
      if (backupPath && existsSync(backupPath)) {
        const undoInfo: DeletedProject = {
          name: projectName,
          originalPath: projectPath,
          backupPath: backupPath,
          deletedAt: new Date().toISOString(),
        };

        mkdirSync(dirname(UNDO_FILE), { recursive: true });
        writeFileSync(UNDO_FILE, JSON.stringify(undoInfo, null, 2));
      }

      console.log();
      p.outro(chalk.green("Project deleted successfully!"));

      if (backupPath) {
        console.log();
        console.log(chalk.gray("To restore this project, run:"));
        console.log(chalk.cyan(`  dx undo`));
        console.log();
        console.log(chalk.gray("Or manually extract:"));
        console.log(chalk.gray(`  ${backupPath}`));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      ui.error(`Failed to delete project: ${errorMessage}`);
      console.log();
      console.log(
        chalk.gray(
          "Try running as administrator or closing any programs using the project.",
        ),
      );
    }
  });

// Undo subcommand
export const undoCommand = new Command("undo")
  .description("Restore the last deleted project")
  .action(async () => {
    console.log();
    p.intro(chalk.bgBlue(chalk.white(" DevKitX - Undo Delete ")));

    if (!existsSync(UNDO_FILE)) {
      ui.error("No recently deleted project to restore");
      console.log(
        chalk.gray(
          "  Undo information is only available within the same session",
        ),
      );
      return;
    }

    let undoInfo: DeletedProject;
    try {
      undoInfo = JSON.parse(readFileSync(UNDO_FILE, "utf-8"));
    } catch {
      ui.error("Could not read undo information");
      return;
    }

    if (!existsSync(undoInfo.backupPath)) {
      ui.error("Backup file no longer exists");
      console.log(chalk.gray(`  Expected: ${undoInfo.backupPath}`));
      return;
    }

    console.log(chalk.gray("  Found deleted project:"));
    console.log();
    console.log(`     Project:    ${chalk.white(undoInfo.name)}`);
    console.log(`     Deleted:    ${chalk.gray(undoInfo.deletedAt)}`);
    console.log(`     Original:   ${chalk.gray(undoInfo.originalPath)}`);
    console.log();

    // Check if original path is available
    if (existsSync(undoInfo.originalPath)) {
      ui.error("Original location already exists!");
      console.log(chalk.gray(`  ${undoInfo.originalPath}`));
      console.log();
      console.log(
        chalk.gray("Manually extract the backup to a different location:"),
      );
      console.log(chalk.cyan(`  ${undoInfo.backupPath}`));
      return;
    }

    const shouldRestore = await p.confirm({
      message: `Restore "${undoInfo.name}" to original location?`,
    });

    if (p.isCancel(shouldRestore) || !shouldRestore) {
      p.cancel("Restore cancelled");
      return;
    }

    console.log();
    console.log(chalk.cyan("Restoring project..."));

    try {
      // Create parent directory if needed
      mkdirSync(dirname(undoInfo.originalPath), { recursive: true });
      mkdirSync(undoInfo.originalPath, { recursive: true });

      // Extract zip
      console.log(chalk.gray("  Extracting backup..."));
      const extractProc = Bun.spawn(
        [
          "powershell",
          "-Command",
          `Expand-Archive -Path "${undoInfo.backupPath}" -DestinationPath "${undoInfo.originalPath}" -Force`,
        ],
        { stdout: "pipe", stderr: "pipe" },
      );

      await extractProc.exited;

      console.log(chalk.green("  ✓ Project restored"));

      // Remove undo file
      rmSync(UNDO_FILE, { force: true });

      console.log();
      p.outro(chalk.green("Project restored successfully!"));
      console.log();
      console.log(chalk.gray("Next steps:"));
      console.log(chalk.cyan(`  cd ${undoInfo.originalPath}`));
      console.log(chalk.cyan("  pnpm install"));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      ui.error(`Failed to restore: ${errorMessage}`);
    }
  });

/**
 * Analyze directory to get stats
 */
async function analyzeDirectory(dirPath: string): Promise<{
  fileCount: number;
  dirCount: number;
  totalSize: number;
  hasNodeModules: boolean;
  nodeModulesSize: number;
}> {
  let fileCount = 0;
  let dirCount = 0;
  let totalSize = 0;
  let hasNodeModules = false;
  let nodeModulesSize = 0;

  function walkDir(dir: string, isNodeModules = false) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        try {
          if (entry.isDirectory()) {
            dirCount++;
            const isNM = entry.name === "node_modules";
            if (isNM) hasNodeModules = true;
            walkDir(fullPath, isNM || isNodeModules);
          } else if (entry.isFile()) {
            fileCount++;
            const stats = statSync(fullPath);
            totalSize += stats.size;
            if (isNodeModules) {
              nodeModulesSize += stats.size;
            }
          }
        } catch {
          // Skip files we can't access
        }
      }
    } catch {
      // Skip directories we can't access
    }
  }

  walkDir(dirPath);

  return { fileCount, dirCount, totalSize, hasNodeModules, nodeModulesSize };
}

/**
 * Format bytes to human readable size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Find all DevKitX projects
 */
async function findAllProjects(homeDir: string): Promise<ProjectInfo[]> {
  const projects: ProjectInfo[] = [];
  const searchDepth = 3;

  const pathsToSearch = SEARCH_PATHS.map((p) => join(homeDir, p)).filter((p) =>
    existsSync(p),
  );

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
    const hasProjectYaml = existsSync(join(dir, "project.yaml"));

    if (hasProjectYaml) {
      const projectInfo = await getProjectInfo(dir);
      if (projectInfo) {
        projects.push(projectInfo);
      }
      return;
    }

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
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
 * Shorten a path for display
 */
function shortenPath(fullPath: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (fullPath.startsWith(homeDir)) {
    return "~" + fullPath.slice(homeDir.length).replace(/\\/g, "/");
  }
  return fullPath.replace(/\\/g, "/");
}
