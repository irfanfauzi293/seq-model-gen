# PRD: seq-model-gen

## 1. Ringkasan Produk

`seq-model-gen` adalah CLI berbasis TypeScript yang dipublikasikan ke npmjs agar dapat di-install secara global atau dijalankan via `npx`. Produk ini membantu developer menghasilkan file model Sequelize secara otomatis berdasarkan struktur tabel database yang sudah ada.

Target utama produk:

- Mengurangi pekerjaan manual saat membuat file model Sequelize.
- Menyamakan format model di berbagai project.
- Mempercepat onboarding dan pengembangan backend yang menggunakan Sequelize.

## 2. Latar Belakang Masalah

Pada project yang memakai Sequelize, developer sering harus:

- Membuka schema database untuk melihat nama kolom dan tipe data.
- Menjaga nama kolom database tetap konsisten saat dijadikan properti model.
- Menulis definisi field Sequelize satu per satu.
- Menentukan ulang daftar atribut model yang akan diekspos.

Proses ini repetitif, rawan typo, dan memakan waktu. Diperlukan generator CLI yang cukup dijalankan dari terminal dengan input minimal.

## 3. Tujuan

Produk versi awal harus mampu:

- Menerima input `table`, `bean`, dan `path` dari terminal.
- Membaca konfigurasi koneksi database dari file `.env` di root project aktif.
- Melakukan koneksi ke database menggunakan Sequelize.
- Mengambil metadata tabel target.
- Menghasilkan file model Sequelize dalam format CommonJS `.js`.
- Menyimpan file hasil generate ke folder tujuan yang diberikan user.

## 4. Non-Goals

Versi awal tidak menargetkan:

- Generate relasi `belongsTo`, `hasMany`, atau `belongsToMany`.
- Generate file migration.
- Generate TypeScript model class.
- Sinkronisasi ulang file yang sudah pernah digenerate.
- Dukungan penuh untuk seluruh fitur tipe data spesifik vendor database.

## 5. Persona Pengguna

### Backend Developer

Developer yang bekerja dengan Sequelize dan database existing, lalu membutuhkan generator cepat untuk membuat model dari tabel yang sudah tersedia.

### Tim Internal / Enterprise Developer

Tim yang memiliki konvensi naming model tertentu dan ingin mempercepat pembuatan model lintas banyak modul.

## 6. User Story

- Sebagai developer, saya ingin menjalankan generator dari terminal agar tidak perlu membuat model manual.
- Sebagai developer, saya ingin cukup memasukkan nama tabel, nama bean, dan folder output agar prosesnya cepat.
- Sebagai developer, saya ingin generator membaca `.env` project agar saya tidak perlu mengetik kredensial database di command line.
- Sebagai developer, saya ingin nama properti model sama persis dengan nama field asli dari tabel.

## 7. Command Interface

Format command utama:

```bash
npx seq-model-gen table:dlos_user bean:userBean path:./src/db
```

Arti parameter:

- `table`: nama tabel di database, misalnya `dlos_user`
- `bean`: nama model/bean Sequelize, misalnya `userBean`
- `path`: folder tujuan file hasil generate, relatif terhadap current working directory

## 8. Konfigurasi `.env`

Generator harus membaca `.env` dari root folder tempat command dijalankan.

Format:

```env
DB_HOST=<host database>
DB_PORT=<port database>
DB_USER=<user database>
DB_PASS=<password database>
DB_NAME=<nama database>
DB_DIALECT=<dialect sequelize, contoh: mysql>
```

Validasi minimum:

- Semua key wajib tersedia.
- `DB_PORT` harus valid sebagai angka.
- `DB_DIALECT` harus sesuai dialect yang didukung implementasi.
- Untuk versi awal, dialect yang didukung adalah `mysql`.

## 9. Output yang Diharapkan

Untuk command:

```bash
npx seq-model-gen table:dlos_user bean:userBean path:./src/db
```

Maka file yang dihasilkan:

```text
./src/db/dlos-user.js
```

Aturan nama file:

- Nama file berasal dari `table`.
- Underscore (`_`) diubah menjadi dash (`-`).
- Ekstensi file adalah `.js`.

Contoh isi target:

```js
module.exports = (sequelize, DataTypes) => {
  const model = sequelize.define('userBean', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id',
      allowNull: false
    }
  }, {
    tableName: 'dlos_user',
    timestamps: false
  });

  model.attributes = ['id'];

  return model;
};
```

## 10. Functional Requirements

### FR-1 CLI Parsing

Sistem harus membaca argumen terminal dalam format `key:value`.

### FR-2 Required Arguments

Sistem harus gagal dengan pesan yang jelas bila `table`, `bean`, atau `path` tidak diberikan.

### FR-3 Env Loading

Sistem harus membaca file `.env` dari `process.cwd()`.

### FR-4 Database Connection

Sistem harus membuat koneksi Sequelize berdasarkan konfigurasi `.env`.

### FR-5 Table Introspection

Sistem harus mengambil metadata tabel menggunakan API introspeksi Sequelize.

### FR-6 Model Generation

Sistem harus menghasilkan file model Sequelize CommonJS yang berisi:

- `sequelize.define('<bean>', { ... }, { tableName: '<table>', timestamps: false })`
- Nama property model sama persis dengan nama field asli tabel
- Properti `field` untuk mempertahankan nama kolom asli
- Properti `allowNull`
- Properti `primaryKey` bila relevan
- Properti `autoIncrement` bila relevan
- `model.attributes` yang berisi daftar properti hasil mapping

### FR-7 Output Directory

Sistem harus membuat folder output bila belum ada.

### FR-8 Overwrite Behavior

Jika file model untuk table yang sama sudah ada, sistem hanya boleh memperbarui definisi kolom di `sequelize.define(..., { ... }, ...)` dan `model.attributes`.

Sistem tidak boleh menimpa blok custom lain seperti:

- `model.associate`
- helper function tambahan
- custom method pada model

### FR-9 Success Feedback

Sistem harus menampilkan lokasi file hasil generate setelah sukses.

### FR-10 Error Feedback

Sistem harus menampilkan error yang mudah dipahami untuk kasus:

- `.env` tidak ditemukan
- Variabel environment tidak lengkap
- Koneksi database gagal
- Tabel tidak ditemukan
- Path output tidak valid

## 11. Mapping Rules

Aturan penamaan minimum:

- `first_name` tetap menjadi `first_name`
- `password_hash` tetap menjadi `password_hash`
- `created_at` tetap menjadi `created_at`
- Nama field asli tetap disimpan dalam properti `field`

Mapping tipe data minimum yang dibutuhkan pada versi awal:

- `INT`, `INTEGER`, `SMALLINT`, `BIGINT`
- `VARCHAR`, `CHAR`, `TEXT`
- `DATE`, `DATETIME`, `TIMESTAMP`
- `BOOLEAN`, `TINYINT(1)`
- `DECIMAL`, `NUMERIC`, `FLOAT`, `DOUBLE`
- `JSON`, `UUID`, `BLOB`, `ENUM`

## 12. Technical Design Summary

Teknologi yang dipakai:

- TypeScript untuk source code utama
- Node.js sebagai runtime CLI
- Sequelize untuk koneksi dan introspeksi schema
- `dotenv` untuk membaca `.env`
- `mysql2` sebagai driver database untuk implementasi awal
- Dukungan database v1 difokuskan ke MySQL

Struktur modul yang direkomendasikan:

- `src/cli.ts`: entry point CLI
- `src/index.ts`: public export
- `src/config.ts`: loader dan validator `.env`
- `src/args.ts`: parser command argument
- `src/generator.ts`: logika introspeksi dan penulisan file
- `src/type-mapper.ts`: mapping tipe database ke `DataTypes`

## 13. Distribusi npm

Requirement publish:

- Package dipublikasikan ke npm dengan nama `seq-model-gen`
- Memiliki field `bin` agar bisa dijalankan sebagai command global
- Hasil build berada di folder `dist`
- Command utama yang diekspos adalah `seq-model-gen`

## 14. UX dan CLI Behavior

Perilaku CLI yang diinginkan:

- Bila user menjalankan command tanpa argumen lengkap, tampilkan usage.
- Bila generate berhasil, tampilkan path file hasil generate.
- Bila koneksi gagal, tampilkan pesan error singkat tanpa stack trace yang berlebihan untuk mode normal.

Contoh usage:

```bash
seq-model-gen table:<table_name> bean:<bean_name> path:<output_path>
```

## 15. Acceptance Criteria

Produk dianggap selesai untuk versi awal bila:

1. User dapat menjalankan `npx seq-model-gen table:dlos_user bean:userBean path:./src/db`.
2. CLI berhasil membaca `.env` dari root project aktif.
3. CLI berhasil terhubung ke database MySQL menggunakan Sequelize.
4. CLI berhasil membaca schema tabel `dlos_user`.
5. CLI menghasilkan file `./src/db/dlos-user.js`.
6. Isi file mengikuti struktur Sequelize model CommonJS yang diharapkan.
7. Nama properti model sama persis dengan nama field asli tabel, dan `field` menyimpan nama kolom asli.
8. CLI memberi exit code non-zero saat proses gagal.
9. Jika file model existing ditemukan, hanya bagian kolom dan `model.attributes` yang berubah.
10. Blok custom seperti `model.associate` tetap tidak berubah setelah generate ulang.

## 16. Future Enhancements

- Dukungan relasi otomatis
- Dukungan multi-file template
- Pilihan output ESM atau TypeScript
- Dukungan lebih luas untuk dialect selain MySQL
- Opsi untuk preserve file existing
- Opsi generate `timestamps` otomatis berdasarkan keberadaan kolom tertentu
