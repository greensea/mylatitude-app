#!/bin/sh
$cordova build --release

cd platforms/android/build/outputs/apk

./command-for-sign-and-zipalign.sh

cd -

exit 0
