/**
 * schema.sql
 *
 * This is the initial schema.
 */

CREATE TABLE migration (
  number INT NOT NULL
);

INSERT INTO migration (number) VALUES (
    1 /* CURRENT MIGRATION */
);

CREATE TABLE record (
    id INTEGER PRIMARY KEY,
    uid INT,
    user TEXT,
    display TEXT,
    expire INT,
    lifetime INT
);

CREATE TABLE session (
    key TEXT NOT NULL,
    redirect TEXT,
    tag TEXT,
    record_id INT,

    UNIQUE(key),
    FOREIGN KEY(record_id) REFERENCES record(id)
);
