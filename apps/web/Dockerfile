# Контекст сборки: корень репозитория
# Не задаём VITE_API_URL/VITE_WS_URL — в рантайме используем тот же хост (origin), nginx проксирует /api и /ws
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY packages ./packages
COPY apps/web ./apps/web

WORKDIR /app/apps/web
ARG WM_VERSION=dev
ARG VITE_YANDEX_MAPS_API_KEY=
ARG VITE_WEB_URL=https://watermelon-messenger.ru
ARG VITE_LEGAL_OPERATOR_TYPE=individual
ARG VITE_LEGAL_OPERATOR_NAME=
ARG VITE_LEGAL_OPERATOR_EMAIL=
ARG VITE_LEGAL_OPERATOR_INN=
ARG VITE_YANDEX_METRIKA_ID=
ENV VITE_APP_VERSION=${WM_VERSION}
ENV VITE_YANDEX_MAPS_API_KEY=${VITE_YANDEX_MAPS_API_KEY}
ENV VITE_WEB_URL=${VITE_WEB_URL}
ENV VITE_LEGAL_OPERATOR_TYPE=${VITE_LEGAL_OPERATOR_TYPE}
ENV VITE_LEGAL_OPERATOR_NAME=${VITE_LEGAL_OPERATOR_NAME}
ENV VITE_LEGAL_OPERATOR_EMAIL=${VITE_LEGAL_OPERATOR_EMAIL}
ENV VITE_LEGAL_OPERATOR_INN=${VITE_LEGAL_OPERATOR_INN}
ENV VITE_YANDEX_METRIKA_ID=${VITE_YANDEX_METRIKA_ID}
RUN npm install
RUN npm run build

# Раздача статики через nginx
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY deploy/nginx-spa-routes.map.conf /etc/nginx/conf.d/spa-routes.map.conf
COPY deploy/nginx-spa-html.map.conf /etc/nginx/conf.d/spa-html.map.conf
COPY deploy/nginx-spa-locations.snippet /etc/nginx/wm-spa-locations.conf
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
