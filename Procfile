release: cd backend && npm install && curl -L https://github.com/ErikGalperyn/vinyl-casik/archive/refs/heads/main.tar.gz | tar -xz --strip-components=2 vinyl-casik-main/backend/uploads vinyl-casik-main/backend/medioteka.db && node scripts/migrate-sqlite-to-postgres.js
web: cd backend && node server.js
