#!/bin/bash
set -e

# Check if docker image exists
if [[ "$(docker images -q cre-cli 2> /dev/null)" == "" ]]; then
  echo "Building cre-cli docker image (this may take a few minutes)..."
  docker build -t cre-cli cre-docker/
fi

# Run cre command inside container
# Mount current directory to /app
# Mount local cre-data to /root/.cre to persist login
# Use host networking for login callback
docker run --rm -it \
  -v $(pwd):/app \
  -v $(pwd)/cre-data:/root/.cre \
  -w /app \
  --net=host \
  cre-cli -c "cre $*"
