FROM node:20-alpine

WORKDIR /linky-tempo

COPY package.json .
COPY yarn.lock .
RUN yarn --production

COPY . .

ENTRYPOINT ["yarn", "start"]