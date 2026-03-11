# We use the 'jammy' tag, which is based on Ubuntu 22.04 LTS.
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Step 2: Set the working directory inside the container.
# All subsequent commands will run from this path.
WORKDIR /usr/src/app

# Step 3: Copy package.json and package-lock.json.
# We copy these first to leverage Docker's layer caching. If these files don't change,
# Docker won't re-run `npm install` on subsequent builds, making them much faster.
COPY package*.json ./

# Step 4: Install all application dependencies from package.json.
# This will install express, mongoose, amqplib, playwright, etc.
RUN npm install

# Step 5: Copy the rest of your application's source code into the container.
# This copies all your folders (models, services, routes, etc.) into the image.
COPY . .

# Step 6: Define the default command to run when the container starts.
# This command starts our long-running worker service, which will listen for jobs.
# We will refactor 'scraper-worker.js' in the next step to be a long-running listener.
CMD ["node", "services/scraper/linkedin/scraper-worker.js"]