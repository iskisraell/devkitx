/**
 * UI utilities for CLI
 */
import chalk from "chalk";

export const theme = {
  primary: chalk.cyan,
  secondary: chalk.gray,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.dim,
  bold: chalk.bold,
  white: chalk.white,
};

export const symbols = {
  success: chalk.green("✓"),
  error: chalk.red("✗"),
  warning: chalk.yellow("!"),
  info: chalk.blue("i"),
  arrow: chalk.cyan("→"),
  bullet: chalk.gray("•"),
  check: chalk.green("◆"),
  pending: chalk.gray("○"),
};

export function header(text: string): void {
  console.log();
  console.log(theme.bold(theme.primary(text)));
  console.log(theme.muted("─".repeat(text.length + 2)));
}

export function success(text: string): void {
  console.log(`${symbols.success} ${theme.success(text)}`);
}

export function error(text: string): void {
  console.log(`${symbols.error} ${theme.error(text)}`);
}

export function warning(text: string): void {
  console.log(`${symbols.warning} ${theme.warning(text)}`);
}

export function info(text: string): void {
  console.log(`${symbols.info} ${theme.info(text)}`);
}

export function listItem(text: string, description?: string): void {
  if (description) {
    console.log(
      `  ${symbols.bullet} ${theme.white(text)} ${theme.muted(`- ${description}`)}`,
    );
  } else {
    console.log(`  ${symbols.bullet} ${theme.white(text)}`);
  }
}

export function table(rows: Array<[string, string]>, padding = 20): void {
  for (const [key, value] of rows) {
    console.log(
      `  ${theme.primary(key.padEnd(padding))} ${theme.white(value)}`,
    );
  }
}

export function divider(): void {
  console.log(theme.muted("─".repeat(50)));
}

export function spacer(): void {
  console.log();
}
