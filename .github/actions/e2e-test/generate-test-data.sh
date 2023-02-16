#!/bin/bash

psql -d $TEST_DATABASE_URL -v "ON_ERROR_STOP=1" -c "CREATE DATABASE migrated;";
psql -d $TEST_DATABASE_URL -v "ON_ERROR_STOP=1" -c "CREATE DATABASE latest;";
psql -d $TEST_DATABASE_URL -v "ON_ERROR_STOP=1" mattermost_test < tests-e2e/db-setup/mattermost.sql;