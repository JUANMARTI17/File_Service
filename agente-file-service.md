# Agente 2: file-service (Next.js + TypeScript). Archivos en Backblaze B2

> **Para Claude Code:** tu tarea es crear desde cero el microservicio **file-service**. Stack: **Next.js (App Router) + TypeScript**, desplegado en Render (proyecto "Electiva"). Guarda archivos en un bucket privado de **Backblaze B2** por la API S3. Lee este documento completo antes de escribir código. Si algo está marcado **[VERIFICAR]** o **[DECIDIR]**, pregunta antes de asumir.

## 0. Reglas de trabajo (obligatorias)

- Antes de empezar, confirma la rama con `git branch --show-current`. Trabaja en la rama acordada, no en `main`.
- Respuestas **cortas** en el chat.
- Ejecuta **solo los tests de lo que cambiaste**. La suite completa solo una vez, al final.
- **Nunca** escribas credenciales en código, en `.env.example` ni en commits. Usa variables de entorno. `.env` va en `.gitignore`.
- Si una decisión no está aquí, pregunta.

## 1. Responsabilidad

El file-service **solo** hace esto:

- Recibe archivos desde users-management.
- Los guarda en Backblaze B2, en la carpeta de cada usuario.
- Devuelve URLs firmadas temporales para descargar.
- Borra archivos.

**No usa** Kafka, OpenSearch ni Valkey. **No tiene base de datos.** La fuente de verdad de qué archivo pertenece a quién es la tabla `user_files` de users-management. El file-service solo sabe de keys.

## 2. Quién lo llama

Solo users-management, que reenvía la petición del cliente con el **mismo header `Authorization: Bearer <JWT>`**. El file-service valida ese JWT. No confía en el userId que llega en la URL sin revisar el token.

## 3. Estructura sugerida (hexagonal)

```
file-service/
├── app/
│   └── api/
│       ├── health/route.ts
│       └── users/[userId]/files/
│           ├── route.ts                 → POST (subir), GET (listar), DELETE (borrar uno por key)
│           ├── all/route.ts             → DELETE (borrar todos del usuario)
│           └── download/route.ts        → GET (URL firmada)
├── src/
│   ├── domain/
│   │   └── stored-file.ts               → tipo StoredFile { key, userId, contentType, size }
│   ├── application/
│   │   ├── ports/
│   │   │   ├── file-storage.port.ts     → upload, getDownloadUrl, delete, list, deleteAllOfUser
│   │   │   └── token-verifier.port.ts   → verify(token) → { userId, role }
│   │   └── use-cases/                   → upload, list, download-url, delete, delete-all
│   └── infrastructure/
│       ├── http/                        → auth y manejo de errores comunes
│       ├── security/jwt-verifier.ts     → implementa TokenVerifierPort con jose
│       ├── storage/b2-s3-adapter.ts     → implementa FileStoragePort con @aws-sdk/client-s3
│       └── config/env.ts                → lee y valida variables (falla al arrancar si falta una)
├── .env.example                         → nombres de variables, sin valores
├── Dockerfile                           → opcional, si Render lo necesita
└── package.json
```

**Regla:** nada de `@aws-sdk` ni de `jose` dentro de `domain` o `application`. Solo en `infrastructure`.

## 4. Backblaze B2 (lo que tú no creas en código)

El usuario ya debe tener esto. Si no, pídelo antes de continuar:

- Bucket **privado**, cifrado SSE-B2, Object Lock deshabilitado.
- Regla de ciclo de vida: "Guardar solo la última versión del archivo".
- Application Key restringida a ese bucket, con **Read and Write**. Nunca la Master Key.

Equivalencias:

- `keyID` = `accessKeyId`.
- `applicationKey` = `secretAccessKey`.
- Endpoint: `https://s3.us-east-005.backblazeb2.com`, región `us-east-005`.
- Usa **path-style** (`forcePathStyle: true`).

## 5. Convención de claves

Cada archivo se guarda como:

```
usuarios/{userId}/{uuid}-{nombreOriginalSaneado}
```

- El `uuid` evita colisiones.
- Sanea el nombre: quita rutas (`../`, `/`, `\`) y caracteres raros. Máximo 200 caracteres.
- **Listar un usuario** = listar el prefijo `usuarios/{userId}/`.
- **Borrar todos** = borrar todo lo que empiece por `usuarios/{userId}/`.

**Regla de seguridad:** toda `key` que llegue en una petición debe empezar por `usuarios/{userId}/` **del userId de la URL**, y ese userId debe coincidir con el del JWT (o ser ADMIN). Si no, responde 403.

## 6. API

| Método | Ruta | Acceso | Acción |
|---|---|---|---|
| POST | `/api/users/:userId/files` | Dueño o ADMIN | Recibe multipart con campo `file`. Sube a B2. Responde `201` con `{ key, size, contentType }`. |
| GET | `/api/users/:userId/files` | Dueño o ADMIN | Lista las keys del prefijo del usuario. |
| GET | `/api/users/:userId/files/download?key=...` | Dueño o ADMIN | Devuelve `{ url, expiresIn: 300 }` con URL firmada. |
| DELETE | `/api/users/:userId/files?key=...` | Dueño o ADMIN | Borra un archivo. Responde `204`. |
| DELETE | `/api/users/:userId/files/all` | Dueño o ADMIN | Borra todos los archivos del usuario. Responde `204`. |
| GET | `/health` | Público | Responde `200 { status: "ok" }`. Lo usa Render. |

**Nota de rutas:** en Next.js App Router, `/api/users/[userId]/files/all` y `/api/users/[userId]/files` son rutas distintas. Revisa que `all` no sea capturado por otra ruta. **[VERIFICAR]** que coincidan con lo que llama users-management. Si cambia el prefijo, usa `/users/...` sin `/api` y ajusta `FILE_SERVICE_URL` en consecuencia. Lo que decidas, anótalo en el README.

## 7. Validación del JWT

- Lee el header `Authorization: Bearer <token>`. Si falta o es inválido, responde **401**.
- Verifica la firma **HS256** con `JWT_SECRET`.
- **[VERIFICAR]** cómo lo decodifica users-management. El secreto es **Base64**: en Node, la clave debe ser `Buffer.from(JWT_SECRET, 'base64')`, no el texto tal cual. Confirma el formato con el código de `JwtTokenService` de users-management. Si no coincide, la validación fallará siempre.
- Lee del token el `sub` (id del usuario) y el rol (`role`). **[VERIFICAR]** el nombre exacto de los claims en users-management.
- Usa la librería `jose`.

## 8. Validación de archivos

- Tamaño máximo **5 MB**. Revisa `file.size` antes de subir. Si pasa, responde **413**.
- Tipos permitidos: `application/pdf`, `image/png`, `image/jpeg`. Si no, responde **415**.
- **Recomendado:** comprobar también los primeros bytes (firma): PDF empieza por `%PDF`, PNG por `89 50 4E 47`, JPEG por `FF D8 FF`.
- Si no hay campo `file`, responde **400**.

## 9. Subida, descarga y borrado con S3

- Cliente: `@aws-sdk/client-s3` con `region`, `endpoint`, `credentials` y `forcePathStyle: true`.
- Subida: `PutObjectCommand` con `Body` como `Buffer`, `ContentType` y `Bucket`.
- URL firmada: `@aws-sdk/s3-request-presigner` con `getSignedUrl(GetObjectCommand, { expiresIn: 300 })`.
- Borrar uno: `DeleteObjectCommand`.
- Borrar todos: `ListObjectsV2Command` con `Prefix: usuarios/{userId}/` y luego `DeleteObjectsCommand` por lotes de 1000. Si hay más de una página, repite.
- **Nunca** devuelvas la clave secreta ni la URL de la API de Backblaze como respuesta.

## 10. Errores

- 400: petición mal formada.
- 401: JWT ausente o inválido.
- 403: el userId no es el del token ni es ADMIN.
- 404: la key no existe en B2 al pedir la URL firmada.
- 413 y 415: validación de archivo.
- 502: Backblaze devolvió error. Registra el detalle en el log, pero **no** lo expongas en la respuesta.

Todas las respuestas de error tienen forma `{ error: "codigo", message: "texto corto" }`.

## 11. Variables de entorno

```env
B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
B2_REGION=us-east-005
B2_BUCKET=<nombre del bucket>
B2_KEY_ID=<keyID>
B2_APP_KEY=<applicationKey>
JWT_SECRET=<el mismo que usa users-management, en Base64>
PORT=3000
```

`.env.example` solo tiene los nombres, sin valores. Valida todas al arrancar y falla con un mensaje claro si falta alguna.

## 12. Despliegue en Render

- Servicio web nuevo en el proyecto **Electiva**.
- Build: `npm install && npm run build`. Start: `npm start`.
- Las variables se configuran en el panel de Render, no en el repo.
- Render free duerme el servicio sin tráfico HTTP. Antes de la demo, llama a `/health`.
- Anota la URL pública: users-management la necesita en `FILE_SERVICE_URL`.

## 13. Pruebas

Tests unitarios de: validación de tipo y tamaño, saneado de nombres, comprobación de dueño, y la regla de que la key pertenece al usuario. Tests de integración con el bucket real solo al final, con un archivo pequeño.

## 14. Criterios de aceptación

- [ ] `GET /health` responde 200.
- [ ] Subir un PDF con JWT válido responde 201 y el objeto aparece en Backblaze en `usuarios/{userId}/`.
- [ ] Sin JWT responde 401. Con JWT de otro usuario responde 403.
- [ ] Un archivo de 6 MB responde 413. Un `.exe` responde 415.
- [ ] La URL de descarga abre el archivo y caduca a los 5 minutos.
- [ ] Borrar uno y borrar todos funcionan y el bucket queda vacío para ese usuario.
- [ ] Ninguna credencial aparece en el repositorio.
