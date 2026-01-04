/**
 * Browser utility - opens URLs in default browser
 */

import { platform } from "os";

export async function openUrl(url: string): Promise<void> {
  const os = platform();

  let command: string;
  let args: string[];

  switch (os) {
    case "darwin":
      command = "open";
      args = [url];
      break;
    case "win32":
      command = "cmd";
      args = ["/c", "start", "", url];
      break;
    default:
      command = "xdg-open";
      args = [url];
  }

  const proc = Bun.spawn([command, ...args], {
    stdout: "ignore",
    stderr: "ignore",
  });

  await proc.exited;
}
