#!/bin/bash

# Start Multiple OCR ML Workers on Different Ports
# This script helps you run multiple ML server instances for load balancing

echo "🚀 Starting OCR ML Worker Servers..."
echo ""

# Configuration
ML_SERVER_DIR="../ml_server"
START_PORT=8001
NUM_WORKERS=3

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if ml_server directory exists
if [ ! -d "$ML_SERVER_DIR" ]; then
    echo "❌ Error: ML server directory not found at $ML_SERVER_DIR"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

# Start workers
PIDS=()
URLS=()

for ((i=0; i<NUM_WORKERS; i++)); do
    PORT=$((START_PORT + i))
    WORKER_NUM=$((i + 1))
    
    echo -e "${BLUE}Starting Worker $WORKER_NUM on port $PORT...${NC}"
    
    cd "$ML_SERVER_DIR"
    PORT=$PORT python3 app.py > "../worker-$WORKER_NUM.log" 2>&1 &
    PID=$!
    cd - > /dev/null
    
    PIDS+=($PID)
    URLS+=("http://localhost:$PORT")
    
    echo -e "${GREEN}✓ Worker $WORKER_NUM started (PID: $PID)${NC}"
    
    # Give each worker a moment to start
    sleep 2
done

echo ""
echo "=========================================="
echo "✅ All workers started successfully!"
echo "=========================================="
echo ""
echo "Worker URLs:"
for ((i=0; i<NUM_WORKERS; i++)); do
    echo "  Worker $((i+1)): ${URLS[$i]} (PID: ${PIDS[$i]})"
done

echo ""
echo "Logs:"
for ((i=0; i<NUM_WORKERS; i++)); do
    echo "  Worker $((i+1)): worker-$((i+1)).log"
done

echo ""
echo "Add this to your .env file:"
echo "ML_WORKER_URLS=$(IFS=,; echo "${URLS[*]}")"

echo ""
echo "=========================================="
echo "To stop all workers, run: ./stop-ml-workers.sh"
echo "Or kill processes manually: kill ${PIDS[@]}"
echo "=========================================="

# Save PIDs to file for stop script
echo "${PIDS[@]}" > .ml-worker-pids

echo ""
echo "Press Ctrl+C to stop monitoring (workers will continue running)"
echo "Monitoring worker logs..."
echo ""

# Monitor logs
tail -f worker-*.log
