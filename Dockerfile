# Dockerfile ✦ node-uniauth

FROM node:18-alpine

ADD /etc/config.docker.yml /etc/node-uniauth.yml
ADD /node-uniauth.js /package.json /package-lock.json /opt/node-uniauth/
ADD /src/ /opt/node-uniauth/src/
ADD /migrations/ /opt/node-uniauth/migrations/

WORKDIR /opt/node-uniauth
RUN apk add --no-cache sqlite \
    && npm install --no-cache --unsafe-perm \
    && mkdir -p /var/lib/node-uniauth

ENV NODE_UNIAUTH_LOG_LEVEL=1
ENV NODE_UNIAUTH_PORT=7033
ENV NODE_UNIAUTH_PATH=
ENV NODE_UNIAUTH_STORAGE_INMEMORY=no
ENV NODE_UNIAUTH_CLEANUP_INTERVAL=3600

VOLUME /var/lib/node-uniauth

ENTRYPOINT ["./node-uniauth.js"]
CMD []
