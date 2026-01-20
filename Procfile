release: cd backend && npm install && curl -L https://github.com/ErikGalperyn/vinyl-casik/archive/refs/heads/main.tar.gz | tar -xz --wildcards --strip-components=2 "*/backend/uploads" "*/backend/medioteka.db" && node scripts/migrate-sqlite-to-postgres.js
web: cd backend && node server.js
