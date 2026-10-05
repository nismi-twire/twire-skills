#!/bin/zsh
# Builds HubstaffBar.app into ~/Applications and starts it at login.
set -e
cd "$(dirname "$0")"
APP="$HOME/Applications/HubstaffBar.app"
LABEL="se.twire.hubstaffbar"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$APP/Contents/MacOS" "$HOME/Library/LaunchAgents"
swiftc -O main.swift -o "$APP/Contents/MacOS/HubstaffBar"
cat > "$APP/Contents/Info.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>$LABEL</string>
  <key>CFBundleName</key><string>HubstaffBar</string>
  <key>CFBundleExecutable</key><string>HubstaffBar</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PL
codesign --force --sign - "$APP" >/dev/null 2>&1 || true

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$APP/Contents/MacOS/HubstaffBar</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
</dict></plist>
PL

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
# bootout returns before the old instance is fully gone, so retry briefly.
for i in 1 2 3 4 5; do
  launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null && break
  [ $i = 5 ] && { echo "Could not start HubstaffBar via launchd" >&2; exit 1; }
  sleep 1
done
echo "Installed $APP (starts at login)"
