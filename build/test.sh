#!/usr/bin/env bash
set -o pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

GO=$1
TESTFLAGS=$2
GOBIN=$3
TIMEOUT=$4

$GO test $TESTFLAGS -v -timeout=$TIMEOUT ./... 2>&1 > >( tee output )
EXIT_STATUS=$?

cat output | $GOBIN/go-junit-report > report.xml
rm output

exit $EXIT_STATUS
