FROM node:current-alpine3.22

RUN apk add --no-cache texlive-full

WORKDIR /usr/src/app

# This leverages Docker's layer caching for faster builds.
COPY package*.json ./
RUN npm install --omit=dev

# 4. Copy the rest of your application's source code.
COPY . .
