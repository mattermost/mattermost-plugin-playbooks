#!/bin/bash

DB_SETUP_SQL_PATH=${DB_SETUP_SQL_PATH:-e2e-tests/cypress/db-setup/mattermost.sql}

psql -d $TEST_DATABASE_URL -v "ON_ERROR_STOP=1" -c "CREATE DATABASE migrated;";
psql -d $TEST_DATABASE_URL -v "ON_ERROR_STOP=1" -c "CREATE DATABASE latest;";
psql -d $TEST_DATABASE_URL -v "ON_ERROR_STOP=1" mattermost_test < "$DB_SETUP_SQL_PATH";
