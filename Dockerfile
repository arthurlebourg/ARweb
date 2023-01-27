FROM node:latest

WORKDIR /usr/src/app

COPY dist/ ./dist/

COPY package*.json server.js tsconfig*.json vite.config.ts ./

RUN npm install

EXPOSE 3000

CMD [ "npm", "run", "serve" ]