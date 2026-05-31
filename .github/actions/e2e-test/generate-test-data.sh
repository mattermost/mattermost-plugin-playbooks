#!/bin/bash

echo "Preparing test databases"
psql -d $TEST_DATABASE_URL -v "ON_ERROR_STOP=1" -c "CREATE DATABASE migrated;";
echo "Created migrated database"
psql -d $TEST_DATABASE_URL -v "ON_ERROR_STOP=1" -c "CREATE DATABASE latest;";
echo "Created latest database"
echo "Restoring mattermost_test database from fixture"
psql -d $TEST_DATABASE_URL -v "ON_ERROR_STOP=1" mattermost_test < e2e-tests/db-setup/mattermost.sql;
echo "Test database setup complete"
