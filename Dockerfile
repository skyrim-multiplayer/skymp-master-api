FROM node:16
#RUN mkdir -p /usr/src/app && chown www-data:www-data /usr/src/app
WORKDIR /usr/src/app
COPY --chown=www-data:www-data package*.json tsconfig.json ./
COPY data/stats0911.csv ./data/
RUN npm install
COPY --chown=www-data:www-data src ./src
EXPOSE 3000
USER www-data
CMD [ "npm", "run", "start" ]
