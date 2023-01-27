FROM node:latest

WORKDIR /usr/src/app

COPY dist/ ./dist/

COPY package*.json server.js tsconfig*.json vite.config.ts ./

RUN mkdir certifications

COPY /etc/letsencrypt/live/ar.arthurlb.fr/fullchain.pem /etc/letsencrypt/live/ar.arthurlb.fr/privkey.pem ./certifications/

RUN npm install

EXPOSE 3000

CMD [ "npm", "run", "serve" ]