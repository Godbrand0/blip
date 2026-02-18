#!/bin/bash
set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Check if docker image exists
if [[ "$(docker images -q cre-cli 2> /dev/null)" == "" ]]; then
  echo "Building cre-cli docker image (this may take a few minutes)..."
  docker build -t cre-cli "$SCRIPT_DIR"
fi

# Calculate relative path from PROJECT_ROOT to current directory
REL_PATH=$(realpath --relative-to="$PROJECT_ROOT" .)
if [[ "$REL_PATH" == "." ]]; then
  CONTAINER_WDIR="/app"
else
  CONTAINER_WDIR="/app/$REL_PATH"
fi

# Run command inside container
# Mount blip-cre directory (PROJECT_ROOT) to /app
# Mount blip-cre/cre-data to /root/.cre to persist login
# Use host networking for login callback
if [[ "$1" == "cre" ]]; then
  docker run --rm -it \
    -v "$PROJECT_ROOT":/app \
    -v "$PROJECT_ROOT/cre-data":/root/.cre \
    -w "$CONTAINER_WDIR" \
    --net=host \
    cre-cli -c "$*"
else
  docker run --rm -it \
    -v "$PROJECT_ROOT":/app \
    -v "$PROJECT_ROOT/cre-data":/root/.cre \
    -w "$CONTAINER_WDIR" \
    --net=host \
    cre-cli -c "$*"
fi
