/**
 * status command - Project health check
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readFileSync, statSync, readdirSync } from "fs";
import { join, basename } from "path";
import { parse } from "yaml";
import { findProjectYaml, readProjectConfig } from "../lib/project-yaml.js";
import * as ui from "../ui/theme.js";

interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "error" | "info";
  message: string;
  details?: string;
}

export const statusCommand = new Command("status")
  .description("Check project health and status")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    console.log();

    // Find project root
    const yamlPath = findProjectYaml();
    const projectPath = yamlPath
      ? yamlPath.replace(/[/\\]project\.yaml$/, "")
      : existsSync(join(process.cwd(), "package.json"))
        ? process.cwd()
        : null;

    if (!projectPath) {
      ui.error("Not in a project directory");
      console.log(chalk.gray("  Run this command from within a project"));
      return;
    }

    const projectName = basename(projectPath);
    const checks: HealthCheck[] = [];

    if (!options.json) {
      console.log(
        chalk.cyan.bold(`  Project Status: ${chalk.white(projectName)}`),
      );
      console.log(chalk.gray("  " + "─".repeat(50)));
      console.log();
    }

    // 1. Check project.yaml
    const hasProjectYaml = existsSync(join(projectPath, "project.yaml"));
    if (hasProjectYaml) {
      checks.push({
        name: "DevKitX Project",
        status: "ok",
        message: "Valid project.yaml found",
      });
    } else {
      checks.push({
        name: "DevKitX Project",
        status: "warn",
        message: "No project.yaml (not a DevKitX project)",
      });
    }

    // 2. Check package.json and dependencies
    const packageJsonPath = join(projectPath, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        const depCount =
          Object.keys(pkg.dependencies || {}).length +
          Object.keys(pkg.devDependencies || {}).length;

        checks.push({
          name: "package.json",
          status: "ok",
          message: `${depCount} dependencies defined`,
          details: pkg.name ? `Name: ${pkg.name}` : undefined,
        });
      } catch {
        checks.push({
          name: "package.json",
          status: "error",
          message: "Invalid package.json",
        });
      }
    } else {
      checks.push({
        name: "package.json",
        status: "error",
        message: "No package.json found",
      });
    }

    // 3. Check node_modules
    const nodeModulesPath = join(projectPath, "node_modules");
    if (existsSync(nodeModulesPath)) {
      const nmSize = await getDirSizeQuick(nodeModulesPath);
      checks.push({
        name: "Dependencies",
        status: "ok",
        message: `Installed (${formatSize(nmSize)})`,
      });
    } else {
      checks.push({
        name: "Dependencies",
        status: "warn",
        message: "Not installed - run 'pnpm install'",
      });
    }

    // 4. Check git status
    const gitPath = join(projectPath, ".git");
    if (existsSync(gitPath)) {
      try {
        const gitStatus = Bun.spawnSync(["git", "status", "--porcelain"], {
          cwd: projectPath,
        });
        const output = gitStatus.stdout.toString().trim();
        const changes = output.split("\n").filter(Boolean).length;

        if (changes === 0) {
          checks.push({
            name: "Git",
            status: "ok",
            message: "Working tree clean",
          });
        } else {
          checks.push({
            name: "Git",
            status: "info",
            message: `${changes} uncommitted change(s)`,
          });
        }

        // Check if behind/ahead
        const gitBranch = Bun.spawnSync(
          ["git", "rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
          { cwd: projectPath },
        );
        const branchOutput = gitBranch.stdout.toString().trim();
        if (branchOutput && !branchOutput.includes("fatal")) {
          const [ahead, behind] = branchOutput.split("\t").map(Number);
          if (behind > 0) {
            checks.push({
              name: "Git Remote",
              status: "warn",
              message: `${behind} commit(s) behind remote`,
            });
          } else if (ahead > 0) {
            checks.push({
              name: "Git Remote",
              status: "info",
              message: `${ahead} commit(s) ahead of remote`,
            });
          }
        }
      } catch {
        checks.push({
          name: "Git",
          status: "ok",
          message: "Repository exists",
        });
      }
    } else {
      checks.push({
        name: "Git",
        status: "warn",
        message: "Not a git repository",
      });
    }

    // 5. Check TypeScript config
    const tsConfigPath = join(projectPath, "tsconfig.json");
    if (existsSync(tsConfigPath)) {
      checks.push({
        name: "TypeScript",
        status: "ok",
        message: "Configured",
      });

      // Try to run type check
      try {
        const tsc = Bun.spawnSync(["npx", "tsc", "--noEmit", "--pretty"], {
          cwd: projectPath,
          timeout: 30000,
        });
        const output = tsc.stderr.toString();
        const errors = (output.match(/error TS\d+/g) || []).length;

        if (errors === 0 && tsc.exitCode === 0) {
          checks.push({
            name: "Type Check",
            status: "ok",
            message: "No errors",
          });
        } else if (errors > 0) {
          checks.push({
            name: "Type Check",
            status: "error",
            message: `${errors} type error(s)`,
            details: "Run 'npx tsc --noEmit' for details",
          });
        }
      } catch {
        // Type check timed out or failed
      }
    }

    // 6. Check for lock file consistency
    const hasPackageLock = existsSync(join(projectPath, "package-lock.json"));
    const hasPnpmLock = existsSync(join(projectPath, "pnpm-lock.yaml"));
    const hasYarnLock = existsSync(join(projectPath, "yarn.lock"));
    const hasBunLock = existsSync(join(projectPath, "bun.lockb"));

    const lockFiles = [
      hasPackageLock,
      hasPnpmLock,
      hasYarnLock,
      hasBunLock,
    ].filter(Boolean).length;

    if (lockFiles === 0) {
      checks.push({
        name: "Lock File",
        status: "warn",
        message: "No lock file found",
      });
    } else if (lockFiles > 1) {
      checks.push({
        name: "Lock File",
        status: "warn",
        message: "Multiple lock files detected",
        details: "Consider keeping only one package manager's lock file",
      });
    } else {
      const lockType = hasPnpmLock
        ? "pnpm"
        : hasYarnLock
          ? "yarn"
          : hasBunLock
            ? "bun"
            : "npm";
      checks.push({
        name: "Lock File",
        status: "ok",
        message: `Using ${lockType}`,
      });
    }

    // 7. Check .env files
    const envFiles = [
      ".env",
      ".env.local",
      ".env.development",
      ".env.production",
    ];
    const existingEnvFiles = envFiles.filter((f) =>
      existsSync(join(projectPath, f)),
    );

    if (existingEnvFiles.length > 0) {
      // Check if .env.example exists
      const hasEnvExample = existsSync(join(projectPath, ".env.example"));
      checks.push({
        name: "Environment",
        status: hasEnvExample ? "ok" : "info",
        message: `${existingEnvFiles.length} env file(s)`,
        details: existingEnvFiles.join(", "),
      });
    }

    // 8. Check disk usage
    const projectSize = await getDirSizeQuick(projectPath);
    checks.push({
      name: "Disk Usage",
      status: projectSize > 1024 * 1024 * 1024 ? "warn" : "info",
      message: formatSize(projectSize),
      details:
        projectSize > 1024 * 1024 * 500
          ? "Consider running 'dx clean'"
          : undefined,
    });

    // 9. Check for running dev servers
    await checkDevServers(projectPath, checks);

    // Output results
    if (options.json) {
      console.log(
        JSON.stringify(
          { project: projectName, path: projectPath, checks },
          null,
          2,
        ),
      );
      return;
    }

    // Display checks
    for (const check of checks) {
      const icon = getStatusIcon(check.status);
      const statusColor = getStatusColor(check.status);
      console.log(
        `  ${icon} ${chalk.white(check.name.padEnd(18))} ${statusColor(check.message)}`,
      );
      if (check.details) {
        console.log(chalk.gray(`     ${check.details}`));
      }
    }

    console.log();
    console.log(chalk.gray("  " + "─".repeat(50)));

    // Summary
    const errors = checks.filter((c) => c.status === "error").length;
    const warnings = checks.filter((c) => c.status === "warn").length;

    if (errors > 0) {
      console.log(chalk.red(`  ${errors} error(s) need attention`));
    } else if (warnings > 0) {
      console.log(chalk.yellow(`  ${warnings} warning(s) to review`));
    } else {
      console.log(chalk.green("  Project looks healthy!"));
    }

    console.log();
  });

/**
 * Check for running development servers
 */
async function checkDevServers(projectPath: string, checks: HealthCheck[]) {
  try {
    // Check common dev server ports
    const ports = [3000, 3001, 5173, 5174, 4000, 8080];

    for (const port of ports) {
      try {
        const result = Bun.spawnSync(
          [
            "powershell",
            "-Command",
            `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue`,
          ],
          { timeout: 2000 },
        );
        const output = result.stdout.toString();

        if (output.includes("Listen") || output.includes("Established")) {
          checks.push({
            name: `Port ${port}`,
            status: "info",
            message: "In use (dev server running?)",
          });
        }
      } catch {
        // Port check failed, skip
      }
    }
  } catch {
    // Dev server check failed
  }
}

/**
 * Get directory size (quick estimate)
 */
async function getDirSizeQuick(dirPath: string): Promise<number> {
  let size = 0;
  const maxDepth = 5;

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        try {
          if (entry.isFile()) {
            size += statSync(fullPath).size;
          } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
            walk(fullPath, depth + 1);
          }
        } catch {
          // Skip inaccessible
        }
      }
    } catch {
      // Skip inaccessible
    }
  }

  walk(dirPath, 0);
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
 * Get status icon
 */
function getStatusIcon(status: HealthCheck["status"]): string {
  switch (status) {
    case "ok":
      return chalk.green("✓");
    case "warn":
      return chalk.yellow("!");
    case "error":
      return chalk.red("✗");
    case "info":
      return chalk.blue("i");
    default:
      return " ";
  }
}

/**
 * Get status color function
 */
function getStatusColor(
  status: HealthCheck["status"],
): (text: string) => string {
  switch (status) {
    case "ok":
      return chalk.green;
    case "warn":
      return chalk.yellow;
    case "error":
      return chalk.red;
    case "info":
      return chalk.gray;
    default:
      return chalk.white;
  }
}
