# Cloud Run image: builds the shared package, the web app, and the API; serves both from one container.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY services/api/package.json services/api/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY services/api services/api
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY services/api/package.json services/api/
RUN npm ci --omit=dev
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/services/api/dist services/api/dist
USER node
EXPOSE 8080
CMD ["node", "services/api/dist/index.js"]
