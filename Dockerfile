FROM node:20-alpine as downloader

WORKDIR /linky-tempo

RUN apk add --no-cache python3 g++ make

COPY package.json .
COPY yarn.lock .
RUN yarn --production

# We don't want to keep apk deps

FROM node:20-alpine

WORKDIR /linky-tempo

COPY --from=downloader /linky-tempo/node_modules /linky-tempo/node_modules
COPY . .

ENTRYPOINT ["yarn", "start"]