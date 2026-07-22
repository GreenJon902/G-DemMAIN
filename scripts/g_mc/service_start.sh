#!/bin/bash

# Agree to eula
echo "eula=true" > /var/lib/g_mc/eula.txt

# Start server
/usr/bin/java -Xms1G -Xmx3G \
-XX:+UseG1GC \
-XX:+ParallelRefProcEnabled \
-XX:MaxGCPauseMillis=200 \
-XX:+UnlockExperimentalVMOptions \
-XX:+DisableExplicitGC \
-XX:+AlwaysPreTouch \
-XX:G1NewSizePercent=30 \
-XX:G1MaxNewSizePercent=40 \
-XX:G1HeapRegionSize=8M \
-XX:G1ReservePercent=20 \
-XX:G1MixedGCCountTarget=4 \
-XX:InitiatingHeapOccupancyPercent=15 \
-XX:G1MixedGCLiveThresholdPercent=90 \
-XX:+PerfDisableSharedMem \
-XX:MaxTenuringThreshold=1 \
-jar /var/lib/g_mc/minecraft_server.jar nogui
