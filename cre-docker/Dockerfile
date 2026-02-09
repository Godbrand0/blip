# Use Ubuntu 24.04 (Noble) as it likely includes GLIBC 2.38+
FROM ubuntu:24.04

# Install required dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    bash \
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
ENV BUN_INSTALL=/root/.bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=$BUN_INSTALL/bin:$PATH

# Install Node.js (Version 20)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install CRE CLI to default location then move to global bin
RUN curl -sSL https://cre.chain.link/install.sh | bash \
    && mv /root/.cre/bin/cre /usr/local/bin/cre \
    && rm -rf /root/.cre

# Create a workspace directory
WORKDIR /app

# Add CRE to path globally (optional since /usr/local/bin is in path)
ENV PATH=/usr/local/bin:$PATH

# Confirm installation
RUN cre version && bun --version && node --version

# Set entrypoint to bash by default
ENTRYPOINT ["/bin/bash"]
