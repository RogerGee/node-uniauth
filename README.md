# node-uniauth

Uniauth server implementation written for Node.js

## Overview

Uniauth is an authentication solution used to help implement single sign-on (SSO) via a simple protocol. Uniauth is designed to work on an internal network with applications that are trusted. (It should not be used to authenticate external applications.)

Uniauth does not implement authentication directly; it only provides a session server to manage and share authentication sessions. A uniauth server can link multiple sessions to one authentication record (e.g. when a user signs in to `alpha.com` via `beta.com`) using a simple authentication flow mechanism.

The server implements the fundamental operations required to implement the authentication within a client. For example, creating a record, reading a record, updating a record and transfering (i.e. linking) one record to another, ETC. The server also manages session lifetime, cleaning up records that have gone past their expiration.

## Installation (without Docker)

Install the service from source (or from `npm` package if available). Run `npm install` in the former case to install dependencies.

Create a YAML config file. Use the `etc/config.sample.yml` file as a reference.

Create the persistent SQLite database for session storage using the following command:

~~~shell
sqlite3 -init ./migrations/schema.sql /path/to/storage.db ''

# If you installed via NPM, you will have to find the `migrations` directory under the installation prefix. Otherwise you can manually retrieve it from the source repository.
~~~

Run the service like so:

~~~shell
./node-uniauth.js -f /path/to/config.yml

# If you installed globally via NPM, the command would be:
node-uniauth -f /path/to/config.yml
~~~

## Installation (with Docker)

Build (or pull down) the Docker image for `node-uniauth`. In this example, we'll use the image `node-uniauth:example`.

The image can be configured entirely with environment variables. See the reference below:

| Variable | Meaning |
| -- | -- |
| `NODE_UNIAUTH_LOG_LEVEL` | Sets the `logging.level` config property |
| `NODE_UNIAUTH_PORT` | Sets the `listen.port` config property |
| `NODE_UNIAUTH_PATH` | Sets the `listen.path` config property; takes precedence over `NODE_UNIAUTH_PORT` |
| `NODE_UNIAUTH_STORAGE_INMEMORY` | Sets the `record_store.inmemory` config property to `true` if given a truethy value; otherwise the SQLite database is used |
| `NODE_UNIAUTH_CLEANUP_INTERVAL` | Sets the `cleanup.interval` config property |

For more on config properties, see _Configuration_ below.

The image requires a single volume at mount point `/var/lib/node-uniauth`. This volume stores the SQLite database having persistent sessions. You must install the database schema (and any subsequent migrations manually). This can be done using `docker run...` like so:

~~~shell
# Replace <your-volume> with the name/path of the volume to mount.
docker run --rm -ti -v <your-volume>:/var/lib/node-uniauth --entrypoint sqlite3 node-uniauth:example -init /opt/node-uniauth/migrations/schema.sql /var/lib/node-uniauth/storage.db ''
~~~

To run a migration, just substitute `schema.sql` with the migration file. (Note: installing `schema.sql` always gives you an update-to-date schema for an empty database.)

## Configuration

The server is configured via a YAML configuration file. By default, this file is loaded from `/etc/node-uniauth.yml`. You can specify the config file path via the command-line using the `-f` option.

See `etc/config.sample.yml` for detailed descriptions of configuration properties and the schema of the configuration file.

If you are using the Docker image, it is recommended that you use the image's environment variables to apply configuration.

## Client implementations

Currently, the following client implementations exist:

| Language | Link |
| -- | -- |
| PHP | https://github.com/RogerGee/php-uniauth |
