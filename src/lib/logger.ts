/**
 * Logging utility for DevKitX
 */

import chalk from "chalk";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export type LogLevel = "debug" | "info" | "warn" | "error" | "success";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: unknown;
}

class Logger {
  private logFile: string | null = null;
  private verbose: boolean = false;

  init(projectPath: string): void {
    const logDir = join(projectPath, ".devkitx");
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    this.logFile = join(logDir, "setup.log");
    this.log("info", "DevKitX setup started");
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  private formatEntry(entry: LogEntry): string {
    let line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
    if (entry.details) {
      line += `\n  Details: ${JSON.stringify(entry.details, null, 2)}`;
    }
    return line;
  }

  private writeToFile(entry: LogEntry): void {
    if (this.logFile) {
      try {
        appendFileSync(this.logFile, this.formatEntry(entry) + "\n");
      } catch {
        // Silently fail file logging
      }
    }
  }

  log(level: LogLevel, message: string, details?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    };

    this.writeToFile(entry);

    // Console output based on level
    switch (level) {
      case "debug":
        if (this.verbose) {
          console.log(chalk.gray(`  [DEBUG] ${message}`));
        }
        break;
      case "info":
        if (this.verbose) {
          console.log(chalk.blue(`  [INFO] ${message}`));
        }
        break;
      case "warn":
        console.log(chalk.yellow(`  ⚠ ${message}`));
        break;
      case "error":
        console.log(chalk.red(`  ✗ ${message}`));
        if (details && this.verbose) {
          console.log(chalk.red(`    ${JSON.stringify(details)}`));
        }
        break;
      case "success":
        if (this.verbose) {
          console.log(chalk.green(`  ✓ ${message}`));
        }
        break;
    }
  }

  debug(message: string, details?: unknown): void {
    this.log("debug", message, details);
  }

  info(message: string, details?: unknown): void {
    this.log("info", message, details);
  }

  warn(message: string, details?: unknown): void {
    this.log("warn", message, details);
  }

  error(message: string, details?: unknown): void {
    this.log("error", message, details);
  }

  success(message: string, details?: unknown): void {
    this.log("success", message, details);
  }

  step(stepName: string): void {
    this.log("info", `Step: ${stepName}`);
  }

  stepComplete(stepName: string): void {
    this.log("success", `Completed: ${stepName}`);
  }

  stepFailed(stepName: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.log("error", `Failed: ${stepName}`, { error: errorMessage });
  }
}

export const logger = new Logger();
