# Runsheet's local MCP server, for registries that build and inspect it (Glama).
# No dependencies: the server is plain Node. It needs a Runsheet API key at run time,
# passed as RUNSHEET_API_KEY; a read-only key is enough to list the tools.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production
ENTRYPOINT ["node", "src/index.mjs"]
