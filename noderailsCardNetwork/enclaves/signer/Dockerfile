FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
CMD ["sh", "-c", "echo Build this image and convert to EIF with nitro-cli"]
