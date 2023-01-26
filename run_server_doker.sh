#!/bin/bash

npm run build

docker build -t archat:latest .

docker run -d -p 3001:3001 --restart unless-stopped archat:latest