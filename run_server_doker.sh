#!/bin/bash

npm run build

docker build -t archat:latest .

docker run -d -p 443:3000 -v /etc/letsencrypt/live/ar.arthurlb.fr/:/usr/src/app/certifications --restart unless-stopped archat:latest