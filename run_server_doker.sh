#!/bin/bash

npm run build

docker build -t archat:latest .

docker stop archat

docker run -d -p 443:3000 --restart unless-stopped --name archat archat:latest