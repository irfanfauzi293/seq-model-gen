const LENGTH_PATTERN = /\(([^)]+)\)/;

export function mapColumnTypeToDataType(type: string): string {
  const normalizedType = type.trim().toUpperCase();

  if (isBooleanLikeType(normalizedType)) {
    return "DataTypes.BOOLEAN";
  }

  if (normalizedType.startsWith("BIGINT")) {
    return "DataTypes.BIGINT";
  }

  if (normalizedType.startsWith("SMALLINT")) {
    return "DataTypes.SMALLINT";
  }

  if (normalizedType.startsWith("MEDIUMINT")) {
    return "DataTypes.INTEGER";
  }

  if (normalizedType.startsWith("INT") || normalizedType.startsWith("INTEGER")) {
    return "DataTypes.INTEGER";
  }

  if (normalizedType.startsWith("DECIMAL") || normalizedType.startsWith("NUMERIC")) {
    return withLength("DataTypes.DECIMAL", normalizedType);
  }

  if (normalizedType.startsWith("DOUBLE PRECISION") || normalizedType.startsWith("DOUBLE")) {
    return "DataTypes.DOUBLE";
  }

  if (normalizedType.startsWith("FLOAT")) {
    return "DataTypes.FLOAT";
  }

  if (normalizedType.startsWith("REAL")) {
    return "DataTypes.REAL";
  }

  if (normalizedType.startsWith("VARCHAR") || normalizedType.startsWith("CHAR")) {
    return withLength("DataTypes.STRING", normalizedType);
  }

  if (normalizedType.includes("TEXT")) {
    return "DataTypes.TEXT";
  }

  if (normalizedType === "DATEONLY") {
    return "DataTypes.DATEONLY";
  }

  if (
    normalizedType.startsWith("DATETIME") ||
    normalizedType.startsWith("TIMESTAMP") ||
    normalizedType === "DATE"
  ) {
    return "DataTypes.DATE";
  }

  if (normalizedType.startsWith("TIME")) {
    return "DataTypes.TIME";
  }

  if (normalizedType.startsWith("JSON")) {
    return "DataTypes.JSON";
  }

  if (normalizedType.startsWith("UUID")) {
    return "DataTypes.UUID";
  }

  if (normalizedType.startsWith("ENUM")) {
    const enumMatch = normalizedType.match(LENGTH_PATTERN);

    if (!enumMatch) {
      return "DataTypes.ENUM";
    }

    return `DataTypes.ENUM(${enumMatch[1]})`;
  }

  if (normalizedType.includes("BLOB") || normalizedType.includes("BINARY")) {
    return "DataTypes.BLOB";
  }

  return "DataTypes.STRING";
}

function isBooleanLikeType(type: string): boolean {
  return (
    type === "BOOLEAN" ||
    type === "BOOL" ||
    type.startsWith("BIT(1)") ||
    type.startsWith("TINYINT")
  );
}

function withLength(prefix: string, type: string): string {
  const lengthMatch = type.match(LENGTH_PATTERN);

  if (!lengthMatch) {
    return prefix;
  }

  return `${prefix}(${lengthMatch[1]})`;
}
