import { config as loadDotEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Dialect } from "sequelize";

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  dialect: Dialect;
}

const SUPPORTED_DIALECTS = ["mysql"] as const;

export function loadDatabaseConfig(cwd = process.cwd()): DatabaseConfig {
  const envPath = resolve(cwd, ".env");

  if (!existsSync(envPath)) {
    throw new Error(`.env file not found in ${cwd}`);
  }

  loadDotEnv({ path: envPath });

  const host = requireEnv("DB_HOST");
  const portValue = requireEnv("DB_PORT");
  const username = requireEnv("DB_USER");
  const password = requireEnv("DB_PASS");
  const database = requireEnv("DB_NAME");
  const dialectValue = requireEnv("DB_DIALECT").toLowerCase();
  const port = Number(portValue);

  if (Number.isNaN(port)) {
    throw new Error("DB_PORT must be a valid number.");
  }

  if (!SUPPORTED_DIALECTS.includes(dialectValue as (typeof SUPPORTED_DIALECTS)[number])) {
    throw new Error(`DB_DIALECT "${dialectValue}" is not supported yet. Available dialects: ${SUPPORTED_DIALECTS.join(", ")}`);
  }

  return {
    host,
    port,
    username,
    password,
    database,
    dialect: dialectValue as Dialect
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Environment variable ${name} is required in the .env file`);
  }

  return value;
}
