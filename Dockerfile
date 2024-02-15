FROM node:20-alpine

WORKDIR /linky-tempo

RUN apk add --no-cache python3 g++ make

COPY package.json .
COPY yarn.lock .
RUN yarn --production

COPY . .

ENTRYPOINT ["yarn", "start"]