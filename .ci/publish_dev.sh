#!/bin/bash
echo "\
registry=https://api.bintray.com/npm/terminusdb/npm-dev
_auth=$BINTRAY_TOKEN
always-auth=true
email=robin@datachemist.com" > $TRAVIS_BUILD_DIR/.npmrc
curl -XDELETE https://api.bintray.com/packages/terminusdb/npm-dev/terminusdb:terminusdb-client -u "rrooij:$BINTRAY_API_TOKEN"
npm publish --access=public