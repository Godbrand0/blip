# CRE Docker Guide

This guide explains how to use the consolidated CRE components within the `blip-cre/` directory using Docker.

## Structure

- `blip-cre/docker/Dockerfile`: Ubuntu-based environment with Bun, Node.js, and the `cre` CLI.
- `blip-cre/docker/run.sh`: Helper script to build the image and run `cre` commands inside a container.

## Usage

### 1. Initialize Docker Environment
The first time you run the script, it will build the `cre-cli` image.

```bash
cd blip-cre/docker
./run.sh version
```

### 2. Available Commands
The `run.sh` script passes all arguments to the `cre` CLI inside the container.

- **Login**: `cd blip-cre/docker && ./run.sh login` (Uses host networking for the callback)
- **Check Projects**: `cd blip-cre/docker && ./run.sh project list`
- **Run Simulation**:
  ```bash
  cd blip-cre/docker
  ./run.sh workflow simulate --target dev
  ```

### 3. Persistent Data
The script mounts `blip-cre/cre-data` to `/root/.cre` inside the container. This ensures your login state and project configurations are persisted across container runs.

> [!NOTE]
> The project root is mounted to `/app` inside the container, so path references in `workflow.yaml` should be relative to the `blip-cre/` root.
