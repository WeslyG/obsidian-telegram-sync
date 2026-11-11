# node:26.13.0-bookworm, matching .node-version.
FROM node@sha256:a546d3f8acd2af4382668a7e6acd3bc4418e6a27478373e3246f8162f5181509

# The dependency volume starts owned by root on a fresh checkout.
RUN apt-get update \
    && apt-get install -y --no-install-recommends sudo \
    && rm -rf /var/lib/apt/lists/* \
    && printf '%s\n' 'node ALL=(root) NOPASSWD: /usr/bin/chown node\:node /workspaces/obsidian-telegram-sync/node_modules' > /etc/sudoers.d/telegram-sync \
    && chmod 0440 /etc/sudoers.d/telegram-sync \
    && visudo -cf /etc/sudoers.d/telegram-sync \
    && git config --system --add safe.directory /workspaces/obsidian-telegram-sync
