/**
 * env command - Manage environment variables
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { existsSync } from "fs";
import { join } from "path";
import * as ui from "../ui/theme.js";
import { findProjectYaml, readProjectConfig } from "../lib/project-yaml.js";

export const envCommand = new Command("env")
  .description("Manage environment variables across apps")
  .addCommand(
    new Command("list")
      .description("List environment variables")
      .action(listEnvVars),
  )
  .addCommand(
    new Command("check")
      .description("Check for missing environment variables")
      .action(checkEnvVars),
  )
  .addCommand(
    new Command("pull")
      .description("Pull environment variables from Vercel")
      .option(
        "--env <environment>",
        "Environment to pull from (development, preview, production)",
        "development",
      )
      .action(pullEnvVars),
  )
  .addCommand(
    new Command("sync")
      .description("Sync environment variables across apps in monorepo")
      .action(syncEnvVars),
  );

async function listEnvVars() {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    ui.error("Not in a DevKitX project");
    return;
  }

  ui.header("Environment Variables");

  // Check various env files
  const envFiles = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.production",
  ];

  for (const file of envFiles) {
    const filePath = join(projectRoot, file);
    if (existsSync(filePath)) {
      console.log();
      console.log(chalk.bold(`  ${file}`));

      const content = await Bun.file(filePath).text();
      const lines = content
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));

      for (const line of lines) {
        const [key] = line.split("=");
        if (key) {
          const hasValue = line.includes("=") && line.split("=")[1]?.trim();
          console.log(
            `    ${hasValue ? chalk.green("●") : chalk.yellow("○")} ${key.trim()}`,
          );
        }
      }
    }
  }

  // Check for .env.example
  const examplePath = join(projectRoot, ".env.example");
  if (existsSync(examplePath)) {
    console.log();
    console.log(chalk.gray("  Template available: .env.example"));
  }

  console.log();
}

async function checkEnvVars() {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    ui.error("Not in a DevKitX project");
    return;
  }

  const examplePath = join(projectRoot, ".env.example");
  const localPath = join(projectRoot, ".env.local");
  const envPath = join(projectRoot, ".env");

  if (!existsSync(examplePath)) {
    ui.warning("No .env.example file found");
    return;
  }

  ui.header("Environment Check");

  // Parse example file
  const exampleContent = await Bun.file(examplePath).text();
  const requiredVars = exampleContent
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => line.split("=")[0]?.trim())
    .filter(Boolean) as string[];

  // Parse actual env files
  const actualVars = new Set<string>();

  for (const path of [localPath, envPath]) {
    if (existsSync(path)) {
      const content = await Bun.file(path).text();
      content
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"))
        .forEach((line) => {
          const [key, value] = line.split("=");
          if (key?.trim() && value?.trim()) {
            actualVars.add(key.trim());
          }
        });
    }
  }

  // Check for missing
  const missing: string[] = [];
  const present: string[] = [];

  for (const varName of requiredVars) {
    if (actualVars.has(varName)) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }

  if (present.length > 0) {
    console.log(chalk.bold("  Configured"));
    for (const v of present) {
      console.log(`    ${chalk.green("✓")} ${v}`);
    }
  }

  if (missing.length > 0) {
    console.log();
    console.log(chalk.bold("  Missing"));
    for (const v of missing) {
      console.log(`    ${chalk.red("✗")} ${v}`);
    }
    console.log();
    ui.warning(`${missing.length} environment variable(s) missing`);
  } else {
    console.log();
    ui.success("All environment variables configured!");
  }

  console.log();
}

async function pullEnvVars(options: { env: string }) {
  ui.header("Pull from Vercel");

  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    ui.error("Not in a DevKitX project");
    return;
  }

  // Check if vercel CLI is installed
  const vercelCheck = Bun.spawn(["vercel", "--version"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await vercelCheck.exited;

  if (vercelCheck.exitCode !== 0) {
    ui.error("Vercel CLI not found");
    console.log();
    console.log("Install with:", chalk.cyan("pnpm add -g vercel"));
    return;
  }

  const s = p.spinner();
  s.start(`Pulling ${options.env} environment variables...`);

  const proc = Bun.spawn(
    ["vercel", "env", "pull", ".env.local", "--environment", options.env],
    { cwd: projectRoot, stdout: "pipe", stderr: "pipe" },
  );

  await proc.exited;

  if (proc.exitCode === 0) {
    s.stop("Environment variables pulled successfully");
    ui.success(`Pulled ${options.env} environment to .env.local`);
  } else {
    const stderr = await new Response(proc.stderr).text();
    s.stop("Failed to pull environment variables");
    ui.error(stderr || "Unknown error");
  }

  console.log();
}

async function syncEnvVars() {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    ui.error("Not in a DevKitX project");
    return;
  }

  const config = await readProjectConfig();
  if (!config?.stack.monorepo) {
    ui.warning("This command is for monorepo projects only");
    return;
  }

  ui.header("Sync Environment Variables");

  const rootEnvPath = join(projectRoot, ".env.local");
  if (!existsSync(rootEnvPath)) {
    ui.error("No .env.local found in project root");
    console.log("Create one first or run:", chalk.cyan("dx env pull"));
    return;
  }

  const rootEnvContent = await Bun.file(rootEnvPath).text();

  // Get all apps
  const apps = Object.entries(config.stack.apps);

  for (const [name, app] of apps) {
    const appPath = join(projectRoot, app.path);
    const appEnvPath = join(appPath, ".env.local");

    if (!existsSync(appPath)) {
      console.log(`  ${chalk.yellow("!")} ${name}: app directory not found`);
      continue;
    }

    // Create symlink or copy
    await Bun.write(appEnvPath, rootEnvContent);
    console.log(`  ${chalk.green("✓")} ${name}: synced .env.local`);
  }

  console.log();
  ui.success("Environment variables synced to all apps");
  console.log();
}

function findProjectRoot(): string | null {
  const yamlPath = findProjectYaml();
  if (!yamlPath) return null;
  return yamlPath.replace("/project.yaml", "").replace("\\project.yaml", "");
}
