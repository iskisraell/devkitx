#!/usr/bin/env bun
/**
 * DevKitX - Developer Toolkit CLI
 * A personalized CLI for modern web development workflows
 */

import { Command } from "commander";
import chalk from "chalk";
import { docsCommand } from "./commands/docs.js";
import { createCommand } from "./commands/create.js";
import { infoCommand } from "./commands/info.js";
import { envCommand } from "./commands/env.js";
import { deployCommand } from "./commands/deploy.js";
import { repairCommand } from "./commands/repair.js";
import { deleteCommand, undoCommand } from "./commands/delete.js";
import { listCommand } from "./commands/list.js";
import { cleanCommand } from "./commands/clean.js";
import { statusCommand } from "./commands/status.js";
import { openCommand } from "./commands/open.js";
import { goCommand } from "./commands/go.js";

const VERSION = "1.0.0";

const program = new Command();

// ASCII Art Banner
const banner = `
${chalk.cyan("╔═══════════════════════════════════════════╗")}
${chalk.cyan("║")}  ${chalk.bold.white("DevKitX")} ${chalk.gray("- Developer Toolkit CLI")}         ${chalk.cyan("║")}
${chalk.cyan("║")}  ${chalk.gray(`v${VERSION}`)}                                  ${chalk.cyan("║")}
${chalk.cyan("╚═══════════════════════════════════════════╝")}
`;

program
  .name("devkitx")
  .description("Developer toolkit for modern web development")
  .version(VERSION)
  .addHelpText("beforeAll", banner);

// Alias support - dx is the shortcut
if (process.argv[1]?.includes("dx")) {
  program.name("dx");
}

// Register commands
program.addCommand(docsCommand);
program.addCommand(createCommand);
program.addCommand(infoCommand);
program.addCommand(envCommand);
program.addCommand(deployCommand);
program.addCommand(repairCommand);
program.addCommand(deleteCommand);
program.addCommand(undoCommand);
program.addCommand(listCommand);
program.addCommand(cleanCommand);
program.addCommand(statusCommand);
program.addCommand(openCommand);
program.addCommand(goCommand);

// Default action - show help with banner
program.action(() => {
  console.log(banner);
  console.log(chalk.white("Project Commands:"));
  console.log(chalk.cyan("  create <name>") + "   Create a new project");
  console.log(chalk.cyan("  info") + "            Show project information");
  console.log(chalk.cyan("  status") + "          Check project health");
  console.log(
    chalk.cyan("  env") + "             Manage environment variables",
  );
  console.log(chalk.cyan("  deploy") + "          Deploy to production");
  console.log(
    chalk.cyan("  repair") + "          Fix incomplete project setup",
  );
  console.log();
  console.log(chalk.white("Management Commands:"));
  console.log(chalk.cyan("  list") + "            List all DevKitX projects");
  console.log(chalk.cyan("  go [name]") + "       Switch to a project");
  console.log(chalk.cyan("  open [target]") + "   Open in editor/browser");
  console.log(chalk.cyan("  clean") + "           Remove build artifacts");
  console.log(chalk.cyan("  delete") + "          Safely delete a project");
  console.log(chalk.cyan("  undo") + "            Restore deleted project");
  console.log();
  console.log(chalk.white("Other Commands:"));
  console.log(chalk.cyan("  docs <topic>") + "    Open documentation");
  console.log();
  console.log(
    chalk.gray("Run") +
      chalk.white(" dx <command> --help ") +
      chalk.gray("for more info"),
  );
});

program.parse();
