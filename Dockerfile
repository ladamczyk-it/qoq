FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY . .
RUN npm ci --ignore-scripts
RUN npm run build
RUN npm run config-inspector -- all
RUN for dir in packages/eslint-v9-*/stats; do \
      mkdir -p "/out/$(dirname "$dir")"; \
      cp -r "$dir" "/out/$dir"; \
    done

FROM scratch
COPY --from=build /out/ /
ENTRYPOINT ["/"]

# use it via `docker build --output=. . ` to produce build files