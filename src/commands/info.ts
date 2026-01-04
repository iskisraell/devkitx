/**
 * info command - Display project information
 */

import { Command } from "commander";
import chalk from "chalk";
import { readProjectConfig, findProjectYaml } from "../lib/project-yaml.js";
import * as ui from "../ui/theme.js";

export const infoCommand = new Command("info")
  .description("Display project information from project.yaml")
  .option("-a, --all", "Show all information including agent notes")
  .action(async (options: { all?: boolean }) => {
    const yamlPath = findProjectYaml();

    if (!yamlPath) {
      ui.error("No project.yaml found in current directory or parents");
      console.log();
      console.log(
        "Run",
        chalk.cyan("dx create <name>"),
        "to create a new project",
      );
      return;
    }

    const config = await readProjectConfig(yamlPath);
    if (!config) {
      ui.error("Failed to parse project.yaml");
      return;
    }

    console.log();
    console.log(chalk.bold.cyan(`  ${config.project.name}`));
    console.log(chalk.gray(`  ${config.project.description}`));
    console.log();

    // Stack info
    ui.header("Stack");

    if (config.stack.monorepo) {
      ui.table([["Monorepo", config.stack.monorepo]]);
    }
    ui.table([["Package Manager", config.stack.package_manager]]);

    // Apps
    console.log();
    console.log(chalk.bold("  Apps"));
    for (const [name, app] of Object.entries(config.stack.apps)) {
      console.log(
        `    ${chalk.cyan(name)} ${chalk.gray(`(${app.framework})`)}`,
      );
      if (app.features && app.features.length > 0) {
        console.log(`      ${chalk.gray(app.features.join(", "))}`);
      }
    }

    // Backend
    if (config.stack.backend) {
      console.log();
      console.log(chalk.bold("  Backend"));
      console.log(`    ${chalk.cyan(config.stack.backend.primary)}`);
      if (config.stack.backend.secondary) {
        console.log(
          `    ${chalk.cyan(config.stack.backend.secondary)} ${chalk.gray("(secondary)")}`,
        );
      }
      if (
        config.stack.backend.features &&
        config.stack.backend.features.length > 0
      ) {
        console.log(
          `      ${chalk.gray(config.stack.backend.features.join(", "))}`,
        );
      }
    }

    // Packages
    if (config.stack.packages && config.stack.packages.length > 0) {
      console.log();
      console.log(chalk.bold("  Packages"));
      for (const pkg of config.stack.packages) {
        console.log(
          `    ${chalk.cyan(pkg.name)} ${chalk.gray(`- ${pkg.description}`)}`,
        );
      }
    }

    // Features
    if (config.features) {
      console.log();
      ui.header("Features");

      if (
        config.features.in_progress &&
        config.features.in_progress.length > 0
      ) {
        console.log(chalk.bold("  In Progress"));
        for (const feature of config.features.in_progress) {
          console.log(`    ${chalk.yellow("●")} ${feature}`);
        }
      }

      if (
        config.features.implemented &&
        config.features.implemented.length > 0
      ) {
        console.log(chalk.bold("  Implemented"));
        for (const feature of config.features.implemented) {
          console.log(`    ${chalk.green("✓")} ${feature}`);
        }
      }

      if (config.features.planned && config.features.planned.length > 0) {
        console.log(chalk.bold("  Planned"));
        for (const feature of config.features.planned) {
          console.log(`    ${chalk.gray("○")} ${feature}`);
        }
      }
    }

    // Agent notes (only with --all flag)
    if (options.all && config.agent_notes) {
      console.log();
      ui.header("Agent Notes");

      if (config.agent_notes.last_session) {
        console.log(
          `  ${chalk.gray("Last session:")} ${config.agent_notes.last_session}`,
        );
      }

      if (config.agent_notes.context) {
        console.log();
        console.log(chalk.bold("  Context"));
        console.log(`    ${config.agent_notes.context}`);
      }

      if (config.agent_notes.todos && config.agent_notes.todos.length > 0) {
        console.log();
        console.log(chalk.bold("  Todos"));
        for (const todo of config.agent_notes.todos) {
          console.log(`    ${chalk.yellow("○")} ${todo}`);
        }
      }

      if (
        config.agent_notes.conventions &&
        config.agent_notes.conventions.length > 0
      ) {
        console.log();
        console.log(chalk.bold("  Conventions"));
        for (const convention of config.agent_notes.conventions) {
          console.log(`    ${chalk.gray("•")} ${convention}`);
        }
      }
    }

    console.log();
    console.log(chalk.gray(`  project.yaml: ${yamlPath}`));
    console.log();
  });
