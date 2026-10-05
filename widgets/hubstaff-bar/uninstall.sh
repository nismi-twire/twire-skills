#!/bin/zsh
LABEL="se.twire.hubstaffbar"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
rm -rf "$HOME/Applications/HubstaffBar.app"
echo "Removed HubstaffBar"
