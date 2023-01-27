#!/bin/bash

npm run build

docker build -t archat:latest .

docker run -d -p 443:3000 --restart unless-stopped archat:latest