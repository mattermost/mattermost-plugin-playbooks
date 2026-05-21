#!/bin/bash

VERSION=${1:-11.7.0-0}

npm add @mattermost/types@${VERSION} @mattermost/client@${VERSION} mattermost-redux@${VERSION} @mattermost/shared@${VERSION}
