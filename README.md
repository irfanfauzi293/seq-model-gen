# seq-model-gen

CLI for generating Sequelize model files from an existing database table schema.

## Installation

```bash
npm install -g seq-model-gen
```

## Configuration

Create a `.env` file in the project root:

```env
DB_HOST=<host database>
DB_PORT=<port database>
DB_USER=<user database>
DB_PASS=<password database>
DB_NAME=<nama database>
DB_DIALECT=mysql
```

The current initial version only supports `mysql`.

## Usage

```bash
npx seq-model-gen table:dlos_user bean:userBean path:./src/db
```

Example output: `./src/db/dlos-user.js`

If a model file for the same table already exists, the generator will only update the model column definition and `model.attributes`. Other custom sections such as `model.associate` will be preserved.

Model property names will follow the original table field names exactly. For example, `first_name` will remain `first_name`, not `firstName`.
