#!/usr/bin/env node

import { parseCliArgs, getUsageText } from "./args";
import { loadDatabaseConfig } from "./config";
import { generateModelFile } from "./generator";

async function main(): Promise<void> {
  try {
    const cliArgs = parseCliArgs(process.argv.slice(2));
    const databaseConfig = loadDatabaseConfig();
    const result = await generateModelFile({
      tableName: cliArgs.table,
      beanName: cliArgs.bean,
      outputPath: cliArgs.path,
      databaseConfig
    });

    if (result.status === "created") {
      process.stdout.write(`Model generated successfully: ${result.filePath}\n`);
      return;
    }

    if (result.status === "updated") {
      process.stdout.write(`Model updated successfully: ${result.filePath}\n`);
      return;
    }

    process.stdout.write(`No changes detected for table "${cliArgs.table}".\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const output = message.includes("Usage:") ? message : `${message}\n${getUsageText()}`;

    process.stderr.write(`${output}\n`);
    process.exitCode = 1;
  }
}

void main();
