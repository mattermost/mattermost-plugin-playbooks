#!/bin/bash

cd ~/mattermost/webapp

VERSION=`jq -r .version channels/package.json`

npm run build -w platform/mattermost-redux
npm pack -w platform/types -w platform/client -w platform/mattermost-redux -w platform/shared

cd -

npm add ~/mattermost/webapp/mattermost-types-${VERSION}.tgz \
    ~/mattermost/webapp/mattermost-client-${VERSION}.tgz \
    ~/mattermost/webapp/mattermost-redux-${VERSION}.tgz \
    ~/mattermost/webapp/mattermost-shared-${VERSION}.tgz
