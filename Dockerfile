# syntax=docker/dockerfile:1.7

FROM debian:trixie-slim

ARG MISE_VERSION=v2025.6.0
ENV MISE_VERSION=${MISE_VERSION}

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       bash \
       zip \
       jq \
       curl \
       git \
       ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://mise.run | sh

ENV PATH="/root/.local/bin:/root/.local/share/mise/shims:${PATH}"
ENV MISE_DATA_DIR="/root/.local/share/mise"
ENV MISE_TRUSTED_CONFIG_PATHS="/app"

WORKDIR /app

COPY mise.toml ./
RUN mise trust mise.toml && mise install

CMD ["bash"]
