/**
 * deploy command - Unified deployment
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import * as ui from "../ui/theme.js";
import { findProjectYaml, readProjectConfig } from "../lib/project-yaml.js";

export const deployCommand = new Command("deploy")
  .description("Deploy your application")
  .option("-p, --prod", "Deploy to production")
  .option("--preview", "Create preview deployment")
  .option("--app <app>", "Specific app to deploy (for monorepos)")
  .action(
    async (options: { prod?: boolean; preview?: boolean; app?: string }) => {
      const yamlPath = findProjectYaml();

      if (!yamlPath) {
        ui.error("Not in a DevKitX project");
        return;
      }

      const config = await readProjectConfig(yamlPath);
      if (!config) {
        ui.error("Failed to read project.yaml");
        return;
      }

      console.log();
      p.intro(chalk.bgCyan(chalk.black(" DevKitX - Deploy ")));

      // Check which services need deploying
      const services: Array<{ name: string; type: string; command: string[] }> =
        [];

      // Vercel deployment
      const vercelArgs = ["vercel"];
      if (options.prod) {
        vercelArgs.push("--prod");
      }
      if (options.app && config.stack.monorepo) {
        vercelArgs.push("--cwd", `apps/${options.app}`);
      }
      services.push({ name: "Vercel", type: "frontend", command: vercelArgs });

      // Convex deployment
      if (
        config.stack.backend?.primary === "convex" ||
        config.stack.backend?.secondary === "convex"
      ) {
        const convexArgs = ["npx", "convex", "deploy"];
        if (!options.prod) {
          // For non-prod, just push to dev
          convexArgs[2] = "dev";
          convexArgs.push("--once");
        }
        services.push({ name: "Convex", type: "backend", command: convexArgs });
      }

      // Supabase deployment
      if (
        config.stack.backend?.primary === "supabase" ||
        config.stack.backend?.secondary === "supabase"
      ) {
        services.push({
          name: "Supabase",
          type: "backend",
          command: ["supabase", "db", "push"],
        });
      }

      // Confirm deployment
      const deployType = options.prod ? "production" : "preview";

      console.log();
      console.log(chalk.bold(`  Deploying to ${deployType}:`));
      for (const service of services) {
        console.log(`    ${chalk.cyan("●")} ${service.name} (${service.type})`);
      }
      console.log();

      const shouldProceed = await p.confirm({
        message: `Deploy to ${deployType}?`,
      });

      if (!shouldProceed || p.isCancel(shouldProceed)) {
        p.cancel("Deployment cancelled");
        return;
      }

      // Deploy each service
      const s = p.spinner();

      for (const service of services) {
        s.start(`Deploying ${service.name}...`);

        try {
          const proc = Bun.spawn(service.command, {
            stdout: "pipe",
            stderr: "pipe",
            cwd: yamlPath
              .replace("/project.yaml", "")
              .replace("\\project.yaml", ""),
          });

          const exitCode = await proc.exited;

          if (exitCode === 0) {
            s.stop(`${service.name} deployed successfully`);

            // Try to get deployment URL from Vercel output
            if (service.name === "Vercel") {
              const stdout = await new Response(proc.stdout).text();
              const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
              if (urlMatch) {
                console.log(
                  `    ${chalk.gray("URL:")} ${chalk.cyan(urlMatch[0])}`,
                );
              }
            }
          } else {
            const stderr = await new Response(proc.stderr).text();
            s.stop(`${service.name} deployment failed`);
            ui.error(stderr || "Unknown error");
          }
        } catch (error) {
          s.stop(`${service.name} deployment failed`);
          ui.error(`${service.name} CLI not found. Install it first.`);
        }
      }

      console.log();
      p.outro(chalk.green("Deployment complete!"));
    },
  );
