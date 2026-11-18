# Mi proyecto

## file-service

Microservicio Next.js (App Router) que guarda archivos en Backblaze B2 (S3). Sin base de datos, Kafka, OpenSearch ni Valkey.

- Rutas con prefijo `/api` (`FILE_SERVICE_URL` apunta a la raíz del servicio): `POST/GET/DELETE /api/users/:userId/files`, `GET /api/users/:userId/files/download?key=`, `DELETE /api/users/:userId/files/all`. Salud: `GET /health`.
- JWT HS256, secreto en Base64, claims `sub` (userId) y `role` (`ADMIN` accede a todo).
- Variables: ver `.env.example`; se validan al arrancar.
- Scripts: `npm run dev`, `npm run build`, `npm start`, `npm test`.
