/**
 * open command - Quick access to project resources
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readFileSync } from "fs";
import { join, basename } from "path";
import { parse } from "yaml";
import { findProjectYaml } from "../lib/project-yaml.js";
import { openUrl } from "../lib/browser.js";
import * as ui from "../ui/theme.js";

export const openCommand = new Command("open")
  .description("Open project in various tools")
  .argument(
    "[target]",
    "What to open: code, github, vercel, folder, convex, supabase",
  )
  .option("-l, --list", "List available open targets")
  .action(async (target: string | undefined, options) => {
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
      return;
    }

    const projectName = basename(projectPath);

    // List mode
    if (options.list || !target) {
      console.log(chalk.cyan.bold("  Open Project Resources"));
      console.log(chalk.gray("  " + "─".repeat(40)));
      console.log();

      const targets = await getAvailableTargets(projectPath);

      for (const t of targets) {
        const status = t.available ? chalk.green("●") : chalk.gray("○");
        console.log(
          `  ${status} ${chalk.white(t.name.padEnd(12))} ${chalk.gray(t.description)}`,
        );
      }

      console.log();
      console.log(chalk.gray("  Usage: dx open <target>"));
      console.log(chalk.gray("  Example: dx open code"));
      console.log();
      return;
    }

    // Normalize target
    const normalizedTarget = target.toLowerCase();

    // Handle targets
    switch (normalizedTarget) {
      case "code":
      case "vscode":
      case "editor":
        await openInEditor(projectPath);
        break;

      case "folder":
      case "explorer":
      case "finder":
        await openInExplorer(projectPath);
        break;

      case "github":
      case "gh":
      case "repo":
        await openGitHub(projectPath);
        break;

      case "vercel":
        await openVercel(projectPath);
        break;

      case "convex":
        await openConvex(projectPath);
        break;

      case "supabase":
        await openSupabase(projectPath);
        break;

      case "terminal":
      case "term":
        await openTerminal(projectPath);
        break;

      default:
        ui.error(`Unknown target: ${target}`);
        console.log(
          chalk.gray("  Run 'dx open --list' to see available targets"),
        );
    }
  });

/**
 * Get available open targets for the project
 */
async function getAvailableTargets(projectPath: string) {
  const targets = [
    {
      name: "code",
      description: "Open in VS Code",
      available: true,
    },
    {
      name: "folder",
      description: "Open in file explorer",
      available: true,
    },
    {
      name: "terminal",
      description: "Open new terminal here",
      available: true,
    },
    {
      name: "github",
      description: "Open GitHub repository",
      available: existsSync(join(projectPath, ".git")),
    },
    {
      name: "vercel",
      description: "Open Vercel dashboard",
      available: existsSync(join(projectPath, ".vercel")),
    },
    {
      name: "convex",
      description: "Open Convex dashboard",
      available:
        existsSync(join(projectPath, "convex")) ||
        existsSync(join(projectPath, ".convex")),
    },
    {
      name: "supabase",
      description: "Open Supabase dashboard",
      available:
        existsSync(join(projectPath, "supabase")) ||
        existsSync(join(projectPath, ".supabase")),
    },
  ];

  return targets;
}

/**
 * Open project in VS Code
 */
async function openInEditor(projectPath: string) {
  console.log(chalk.gray("  Opening in VS Code..."));

  try {
    const proc = Bun.spawn(["code", projectPath], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
    console.log(chalk.green("  ✓ Opened in VS Code"));
  } catch {
    ui.error("Failed to open VS Code");
    console.log(chalk.gray("  Make sure 'code' is in your PATH"));
    console.log(
      chalk.gray("  VS Code > Cmd+Shift+P > 'Shell Command: Install code'"),
    );
  }
}

/**
 * Open project in file explorer
 */
async function openInExplorer(projectPath: string) {
  console.log(chalk.gray("  Opening in file explorer..."));

  try {
    // Windows
    const proc = Bun.spawn(["explorer", projectPath], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
    console.log(chalk.green("  ✓ Opened in Explorer"));
  } catch {
    ui.error("Failed to open file explorer");
  }
}

/**
 * Open GitHub repository
 */
async function openGitHub(projectPath: string) {
  console.log(chalk.gray("  Finding GitHub repository..."));

  try {
    const result = Bun.spawnSync(["git", "remote", "get-url", "origin"], {
      cwd: projectPath,
    });
    const remoteUrl = result.stdout.toString().trim();

    if (!remoteUrl) {
      ui.error("No git remote found");
      return;
    }

    // Convert SSH URL to HTTPS if needed
    let url = remoteUrl;
    if (url.startsWith("git@github.com:")) {
      url = url
        .replace("git@github.com:", "https://github.com/")
        .replace(/\.git$/, "");
    } else if (url.startsWith("https://")) {
      url = url.replace(/\.git$/, "");
    }

    console.log(chalk.gray(`  Opening: ${url}`));
    await openUrl(url);
    console.log(chalk.green("  ✓ Opened GitHub"));
  } catch {
    ui.error("Failed to open GitHub");
    console.log(chalk.gray("  Make sure git remote is configured"));
  }
}

/**
 * Open Vercel dashboard
 */
async function openVercel(projectPath: string) {
  console.log(chalk.gray("  Finding Vercel project..."));

  const vercelConfigPath = join(projectPath, ".vercel", "project.json");

  if (existsSync(vercelConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(vercelConfigPath, "utf-8"));
      const url = `https://vercel.com/${config.orgId}/${config.projectId}`;
      console.log(chalk.gray(`  Opening Vercel dashboard...`));
      await openUrl(url);
      console.log(chalk.green("  ✓ Opened Vercel"));
      return;
    } catch {
      // Fall through to default
    }
  }

  // Try to get from project name
  const projectName = basename(projectPath);
  const url = `https://vercel.com/dashboard`;
  console.log(chalk.gray("  Opening Vercel dashboard (project not linked)..."));
  await openUrl(url);
  console.log(chalk.green("  ✓ Opened Vercel dashboard"));
}

/**
 * Open Convex dashboard
 */
async function openConvex(projectPath: string) {
  console.log(chalk.gray("  Opening Convex dashboard..."));

  // Try to find project from .env.local
  const envLocalPath = join(projectPath, ".env.local");
  if (existsSync(envLocalPath)) {
    try {
      const envContent = readFileSync(envLocalPath, "utf-8");
      const match = envContent.match(/CONVEX_DEPLOYMENT=([^\s]+)/);
      if (match) {
        const deployment = match[1].replace(/"/g, "");
        // Extract project slug from deployment URL
        const projectSlug = deployment.split(":")[0];
        if (projectSlug && !projectSlug.includes("http")) {
          const url = `https://dashboard.convex.dev/d/${projectSlug}`;
          await openUrl(url);
          console.log(chalk.green("  ✓ Opened Convex dashboard"));
          return;
        }
      }
    } catch {
      // Fall through
    }
  }

  // Default to Convex dashboard
  await openUrl("https://dashboard.convex.dev");
  console.log(chalk.green("  ✓ Opened Convex dashboard"));
}

/**
 * Open Supabase dashboard
 */
async function openSupabase(projectPath: string) {
  console.log(chalk.gray("  Opening Supabase dashboard..."));

  // Try to find project from .env or .env.local
  const envFiles = [".env.local", ".env"];
  for (const envFile of envFiles) {
    const envPath = join(projectPath, envFile);
    if (existsSync(envPath)) {
      try {
        const envContent = readFileSync(envPath, "utf-8");
        const match = envContent.match(
          /SUPABASE_URL=["']?https:\/\/([^.]+)\.supabase\.co/,
        );
        if (match) {
          const projectRef = match[1];
          const url = `https://supabase.com/dashboard/project/${projectRef}`;
          await openUrl(url);
          console.log(chalk.green("  ✓ Opened Supabase dashboard"));
          return;
        }
      } catch {
        // Fall through
      }
    }
  }

  // Default to Supabase dashboard
  await openUrl("https://supabase.com/dashboard");
  console.log(chalk.green("  ✓ Opened Supabase dashboard"));
}

/**
 * Open a new terminal in the project directory
 */
async function openTerminal(projectPath: string) {
  console.log(chalk.gray("  Opening new terminal..."));

  try {
    // Windows Terminal
    const proc = Bun.spawn(["wt", "-d", projectPath], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
    console.log(chalk.green("  ✓ Opened Windows Terminal"));
  } catch {
    try {
      // Fallback to PowerShell
      const proc = Bun.spawn(
        ["powershell", "-NoExit", "-Command", `Set-Location '${projectPath}'`],
        {
          stdout: "ignore",
          stderr: "ignore",
        },
      );
      console.log(chalk.green("  ✓ Opened PowerShell"));
    } catch {
      ui.error("Failed to open terminal");
    }
  }
}
