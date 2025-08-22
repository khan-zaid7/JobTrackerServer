FROM node:current-alpine3.22

RUN apk add --no-cache poppler-utils

# setup working director
WORKDIR /urs/src/app

# copy package.json and package.lock json first
COPY package*.json ./
COPY start.sh ./


# Install our application's dependencies 
RUN chmod +x /urs/src/app/start.sh
RUN npm install --production

# Now copy the rest of the sourcecode
COPY . .

# setup port 
EXPOSE 5000

# define the command to run when the container starts 
# CMD ["./start.sh" ]
