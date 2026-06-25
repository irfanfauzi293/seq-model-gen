import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Sequelize } from "sequelize";
import { DatabaseConfig } from "./config";
import { mapColumnTypeToDataType } from "./type-mapper";

interface GenerateModelParams {
  tableName: string;
  beanName: string;
  outputPath: string;
  databaseConfig: DatabaseConfig;
  cwd?: string;
}

interface ColumnDefinition {
  type: string;
  allowNull: boolean;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  defaultValue?: unknown;
}

export interface GenerateModelResult {
  filePath: string;
  status: "created" | "updated" | "unchanged";
}

interface BuildOutputSourceResult {
  source: string;
  status: GenerateModelResult["status"];
}

interface UpdateExistingModelSourceResult {
  source: string;
  changed: boolean;
}

export async function generateModelFile(params: GenerateModelParams): Promise<GenerateModelResult> {
  const cwd = params.cwd ?? process.cwd();
  const sequelize = new Sequelize(params.databaseConfig.database, params.databaseConfig.username, params.databaseConfig.password, {
    host: params.databaseConfig.host,
    port: params.databaseConfig.port,
    dialect: params.databaseConfig.dialect,
    logging: false
  });

  try {
    await sequelize.authenticate();

    const tableDefinition = await sequelize.getQueryInterface().describeTable(params.tableName);
    const outputDirectory = resolve(cwd, params.outputPath);
    const filePath = resolve(outputDirectory, `${toKebabCase(params.tableName)}.js`);
    const buildResult = await buildOutputSource({
      beanName: params.beanName,
      tableName: params.tableName,
      tableDefinition: tableDefinition as Record<string, ColumnDefinition>,
      filePath
    });

    await mkdir(outputDirectory, { recursive: true });
    if (buildResult.status !== "unchanged") {
      await writeFile(filePath, buildResult.source, "utf8");
    }

    return {
      filePath,
      status: buildResult.status
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Failed to generate model for table "${params.tableName}": ${message}`);
  } finally {
    await sequelize.close();
  }
}

export function buildModelSource(
  beanName: string,
  tableName: string,
  tableDefinition: Record<string, ColumnDefinition>
): string {
  const fieldEntries = buildFieldEntries(tableDefinition);
  const attributesLiteral = buildAttributesLiteral(tableDefinition);

  return `module.exports = (sequelize, DataTypes) => {
  const model = sequelize.define('${beanName}', {
${fieldEntries}
  }, {
    tableName: '${tableName}',
    timestamps: false
  });

  model.attributes = ${attributesLiteral};

  return model;
};
`;
}

async function buildOutputSource(params: {
  beanName: string;
  tableName: string;
  tableDefinition: Record<string, ColumnDefinition>;
  filePath: string;
}): Promise<BuildOutputSourceResult> {
  const generatedSource = buildModelSource(params.beanName, params.tableName, params.tableDefinition);

  try {
    const existingSource = await readFile(params.filePath, "utf8");

    const updateResult = updateExistingModelSource(existingSource, params.tableDefinition);

    return {
      source: updateResult.source,
      status: updateResult.changed ? "updated" : "unchanged"
    };
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return {
        source: generatedSource,
        status: "created"
      };
    }

    throw error;
  }
}

export function updateExistingModelSource(
  existingSource: string,
  tableDefinition: Record<string, ColumnDefinition>
): UpdateExistingModelSourceResult {
  const fieldEntries = buildFieldEntries(tableDefinition);
  const attributesLiteral = buildAttributesLiteral(tableDefinition);
  const updatedDefineBlock = existingSource.replace(
    /(sequelize\.define\(\s*['"`][^'"`]+['"`]\s*,\s*)\{[\s\S]*?(\}\s*,\s*\{)/,
    `$1{\n${fieldEntries}\n  $2`
  );

  if (updatedDefineBlock === existingSource) {
    if (hasNoTableChanges(existingSource, tableDefinition)) {
      return {
        source: existingSource,
        changed: false
      };
    }

    throw new Error("The existing model file could not be patched automatically. Make sure the sequelize.define format is still standard.");
  }

  if (/model\.attributes\s*=/.test(updatedDefineBlock)) {
    const nextSource = updatedDefineBlock.replace(
      /model\.attributes\s*=\s*\[[\s\S]*?\];/,
      `model.attributes = ${attributesLiteral};`
    );

    return {
      source: nextSource,
      changed: nextSource !== existingSource
    };
  }

  if (/return model;/.test(updatedDefineBlock)) {
    const nextSource = updatedDefineBlock.replace(
      /\n(\s*)return model;/,
      `\n$1model.attributes = ${attributesLiteral};\n\n$1return model;`
    );

    return {
      source: nextSource,
      changed: nextSource !== existingSource
    };
  }

  throw new Error("The existing model file does not contain a patchable model.attributes or return model marker.");
}

function buildFieldEntries(tableDefinition: Record<string, ColumnDefinition>): string {
  return Object.entries(tableDefinition)
    .map(([columnName, definition]) => buildFieldBlock(columnName, definition))
    .join(",\n");
}

function buildAttributesLiteral(tableDefinition: Record<string, ColumnDefinition>): string {
  const attributeNames = Object.keys(tableDefinition);

  return `[${attributeNames.map((name) => `'${name}'`).join(", ")}]`;
}

function buildFieldBlock(columnName: string, definition: ColumnDefinition): string {
  const propertyLines = [
    `      type: ${mapColumnTypeToDataType(definition.type)}`,
    `      field: '${columnName}'`,
    `      allowNull: ${definition.allowNull}`
  ];

  if (definition.primaryKey) {
    propertyLines.splice(1, 0, "      primaryKey: true");
  }

  if (definition.autoIncrement) {
    const insertIndex = definition.primaryKey ? 3 : 2;
    propertyLines.splice(insertIndex, 0, "      autoIncrement: true");
  }

  if (shouldIncludeDefaultValue(definition)) {
    propertyLines.push(`      defaultValue: ${formatDefaultValue(definition.defaultValue, definition.type)}`);
  }

  const lines = [`    ${columnName}: {`];

  propertyLines.forEach((line, index) => {
    const suffix = index === propertyLines.length - 1 ? "" : ",";
    lines.push(`${line}${suffix}`);
  });

  lines.push("    }");

  return lines.join("\n");
}

function hasNoTableChanges(
  existingSource: string,
  tableDefinition: Record<string, ColumnDefinition>
): boolean {
  const expectedFields = Object.keys(tableDefinition);
  const existingFields = extractFieldNames(existingSource);
  const existingAttributes = extractAttributeNames(existingSource);
  const existingFieldBlock = extractDefinedFieldBlock(existingSource);
  const expectedFieldBlock = buildFieldEntries(tableDefinition);

  if (!arraysEqual(existingFields, expectedFields)) {
    return false;
  }

  if (existingAttributes !== null && !arraysEqual(existingAttributes, expectedFields)) {
    return false;
  }

  if (existingFieldBlock === null) {
    return false;
  }

  if (normalizeComparableBlock(existingFieldBlock) !== normalizeComparableBlock(expectedFieldBlock)) {
    return false;
  }

  return true;
}

function shouldIncludeDefaultValue(definition: ColumnDefinition): boolean {
  return definition.defaultValue !== undefined && definition.defaultValue !== null;
}

function formatDefaultValue(value: unknown, columnType: string): string {
  if (isBooleanType(columnType)) {
    if (value === 1 || value === "1" || value === true || value === "true" || value === "TRUE") {
      return "true";
    }

    if (value === 0 || value === "0" || value === false || value === "false" || value === "FALSE") {
      return "false";
    }
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    const upper = normalized.toUpperCase();

    if (upper === "CURRENT_TIMESTAMP") {
      return "DataTypes.NOW";
    }

    if (upper === "NULL") {
      return "null";
    }

    if (upper === "TRUE" || upper === "FALSE") {
      return upper.toLowerCase();
    }

    if (/^-?\d+(\.\d+)?$/.test(normalized)) {
      return normalized;
    }

    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

function isBooleanType(type: string): boolean {
  const normalizedType = type.trim().toUpperCase();

  return (
    normalizedType === "BOOLEAN" ||
    normalizedType === "BOOL" ||
    normalizedType.startsWith("BIT(1)") ||
    normalizedType.startsWith("TINYINT")
  );
}

function extractFieldNames(source: string): string[] {
  const matches = source.matchAll(/field:\s*['"`]([^'"`]+)['"`]/g);

  return Array.from(matches, (match) => match[1]);
}

function extractDefinedFieldBlock(source: string): string | null {
  const match = source.match(/sequelize\.define\(\s*['"`][^'"`]+['"`]\s*,\s*\{([\s\S]*?)\}\s*,\s*\{/);

  return match?.[1] ?? null;
}

function extractAttributeNames(source: string): string[] | null {
  const attributesMatch = source.match(/model\.attributes\s*=\s*\[([\s\S]*?)\];/);

  if (!attributesMatch) {
    return null;
  }

  const itemMatches = attributesMatch[1].matchAll(/['"`]([^'"`]+)['"`]/g);

  return Array.from(itemMatches, (match) => match[1]);
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function normalizeComparableBlock(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function isFileNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
  );
}

export function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}
