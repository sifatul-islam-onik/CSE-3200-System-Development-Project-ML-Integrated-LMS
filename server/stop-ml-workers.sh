#!/bin/bash

# Stop all OCR ML Worker Servers

echo "🛑 Stopping OCR ML Worker Servers..."

if [ ! -f ".ml-worker-pids" ]; then
    echo "❌ No worker PIDs found. Workers may not be running."
    exit 1
fi

# Read PIDs from file
PIDS=$(cat .ml-worker-pids)

# Kill each process
for PID in $PIDS; do
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping worker (PID: $PID)..."
        kill $PID
        echo "✓ Worker stopped"
    else
        echo "⚠ Worker (PID: $PID) not running"
    fi
done

# Clean up
rm -f .ml-worker-pids
rm -f worker-*.log

echo ""
echo "✅ All workers stopped and cleaned up"
