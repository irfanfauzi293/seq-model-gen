export interface CliArgs {
  table: string;
  bean: string;
  path: string;
}

const REQUIRED_KEYS = ["table", "bean", "path"] as const;

export function parseCliArgs(argv: string[]): CliArgs {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    throw new Error(getUsageText());
  }

  const parsed: Record<string, string> = {};

  for (const rawArg of argv) {
    const separatorIndex = rawArg.indexOf(":");

    if (separatorIndex <= 0) {
      throw new Error(`Invalid argument: "${rawArg}".\n${getUsageText()}`);
    }

    const key = rawArg.slice(0, separatorIndex).trim();
    const value = rawArg.slice(separatorIndex + 1).trim();

    if (!key || !value) {
      throw new Error(`Invalid argument: "${rawArg}".\n${getUsageText()}`);
    }

    parsed[key] = value;
  }

  for (const requiredKey of REQUIRED_KEYS) {
    if (!parsed[requiredKey]) {
      throw new Error(`Argument "${requiredKey}" is required.\n${getUsageText()}`);
    }
  }

  return {
    table: parsed.table,
    bean: parsed.bean,
    path: parsed.path
  };
}

export function getUsageText(): string {
  return "Usage: seq-model-gen table:<table_name> bean:<bean_name> path:<output_path>";
}
