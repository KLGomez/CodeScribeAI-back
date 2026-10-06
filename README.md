# CodeScribe AI — Backend Service (`CodeScribeAI-back`)

> **Microservicio Backend y Orquestador de Tareas desarrollado con NestJS 12, TypeScript, BullMQ, Redis y MongoDB.**

---

## 🚀 Descripción del Proyecto

El **Backend de CodeScribe AI** gestiona el ciclo de vida completo de análisis, autenticación, persistencia y exportación de documentación técnica:
- **Autenticación Segura y Modo Demo:** Flujo OAuth 2.0 con GitHub mediante canje de código efímero de un solo uso (32 bytes, TTL 60 s en Redis) para evitar exposición de JWT en la URL. Modo Demo con cuentas efímeras aisladas (TTL 24 h en Redis) y cuota de 2 análisis.
- **Cifrado Simétrico Autenticado (AES-256-GCM):** Almacenamiento seguro de tokens personales de GitHub y Notion en base de datos (`select: false`), con soporte retrocompatible para descifrado de registros antiguos.
- **Encolamiento Asíncrono con BullMQ y Redis:** Procesamiento resiliente en segundo plano con reintentos y retroceso exponencial hacia el microservicio de IA.
- **Streaming en Tiempo Real con Server-Sent Events (SSE):** Emisión continua de progreso en porcentaje y etapas (`fetching_repo`, `analyzing_structure`, `generating_docs`, `saving_documentation`), con autorización estricta por token JWT en cabecera `Authorization: Bearer <token>`.
- **Integración Nativa con Notion:** Flujo OAuth público donde los tokens de Notion residen exclusivamente en el backend; endpoints para listar páginas autorizadas y exportación estructurada respetando los límites de bloques de Notion (máximo 100 bloques por lote y 2.000 caracteres por bloque de texto).
- **Protección y Rate Limiting:** Guard global `ThrottlerGuard` activo, validación estricta de propiedad de jobs y documentos, y validación estricta de secretos en arranque de producción.

---

## 🛠️ Stack Tecnológico

- **Framework:** [NestJS](https://nestjs.com/) v12.0
- **Runtime:** Node.js (v22) con TypeScript
- **Base de Datos NoSQL:** MongoDB 7.0 + Mongoose 9.10
- **Cola de Mensajes & Caché:** Redis 7.0 + BullMQ 6.3 + ioredis 6.0
- **Seguridad & Autenticación:** Passport.js (`passport-github2`, `passport-jwt`), Helmet, `@nestjs/throttler`, cifrado nativo autenticado (AES-256-GCM)
- **Integración Externa:** `@notionhq/client`, `@tryfabric/martian`
- **Pruebas y Calidad:** Vitest 4.1, Oxlint

---

## ⚙️ Variables de Entorno

| Variable | Tipo / Valor | Obligatoria en Prod | Descripción |
|---|---|:---:|---|
| `PORT` | `3001` | No | Puerto de escucha HTTP del backend (default: `3001`). |
| `NODE_ENV` | `production` / `development` | **Sí** | Entorno de ejecución (habilita validaciones estrictas de secretos). |
| `FRONTEND_URL` | URL (ej: `https://codescribe.ejemplo.com`) | **Sí** | URL base del cliente para CORS, redirección OAuth y cookies. |
| `MONGODB_URI` | Cadena de conexión Mongo | **Sí** | URI de conexión a MongoDB (ej: `mongodb://mongo:27017/codescribe`). |
| `REDIS_HOST` | Hostname (ej: `redis`) | **Sí** | Host del servidor Redis para BullMQ y códigos de intercambio. |
| `REDIS_PORT` | `6379` | No | Puerto de Redis (default: `6379`). |
| `REDIS_PASSWORD` | String secreto | No | Contraseña de autenticación de Redis (recomendada en producción). |
| `AI_SERVICE_URL` | URL interna (ej: `http://ai-service:8000`) | **Sí** | URL del microservicio de IA (comunicación interna). |
| `AI_SERVICE_SECRET` | String (>= 16 caracteres) | **Sí** | Clave compartida para la cabecera `X-Internal-Secret`. |
| `JWT_SECRET` | String (>= 32 caracteres) | **Sí** | Clave secreta para firmar y verificar tokens JWT. |
| `JWT_EXPIRES_IN` | `7d` | No | Tiempo de expiración de tokens JWT de sesión (default: `7d`). |
| `GITHUB_CLIENT_ID` | String | **Sí** | Client ID de la GitHub OAuth App de producción. |
| `GITHUB_CLIENT_SECRET` | String secreto | **Sí** | Client Secret de la GitHub OAuth App de producción. |
| `GITHUB_CALLBACK_URL` | URL | **Sí** | URL de callback registrada en GitHub (ej: `https://api.../api/auth/github/callback`). |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | String (exactamente 32 chars) | **Sí** | Clave criptográfica para cifrado AES-256-GCM de tokens de GitHub. |
| `GITHUB_FALLBACK_TOKEN` | Token personal GitHub | No | Token del servidor con permisos de lectura para análisis en modo demo. |
| `NOTION_CLIENT_ID` | UUID / String | **Sí** | Client ID de la integración pública OAuth de Notion. |
| `NOTION_CLIENT_SECRET` | String secreto | **Sí** | Client Secret de la integración pública OAuth de Notion. |
| `NOTION_REDIRECT_URI` | URL | **Sí** | Redirect URI autorizada en Notion (ej: `https://codescribe.../auth/notion/callback`). |
| `THROTTLE_TTL` | Segundos (`60`) | No | Ventana de tiempo para el limitador de peticiones (default: `60`). |
| `THROTTLE_LIMIT` | Número (`10`) | No | Máximo de peticiones por IP en la ventana TTL (default: `10`). |

---

## 📡 Endpoints de la API (`/api`)

Todos los endpoints exponen el prefijo `/api`:

| Verbo | Ruta | Auth | Descripción |
|---|---|:---:|---|
| `GET` | `/api/health` | Pública | Chequeo de salud del servicio y conectividad activa con MongoDB. |
| `POST` | `/api/auth/demo` | Pública | Genera una sesión demo efímera (TTL 24 h, cuota de 2 análisis). |
| `GET` | `/api/auth/github` | Pública | Inicia el flujo de autenticación con GitHub OAuth 2.0. |
| `GET` | `/api/auth/github/callback` | Pública | Callback de GitHub. Genera un código de un solo uso en Redis y redirige al front. |
| `POST` | `/api/auth/exchange` | Pública (Throttle) | Canjea el código de un solo uso por `{ token, user }`. Invalida el código tras su uso. |
| `GET` | `/api/auth/me` | JWT | Retorna el perfil y cuotas del usuario autenticado actual. |
| `POST` | `/api/jobs` | JWT | Encola un nuevo análisis de repositorio `{ repoUrl }`. Valida cuotas y límites. |
| `GET` | `/api/jobs/:id` | JWT | Consulta el estado, progreso y errores tipificados del job (valida propiedad). |
| `GET` | `/api/jobs/:id/stream` | JWT | Stream de Server-Sent Events (SSE) con progreso y etapas en tiempo real. |
| `GET` | `/api/documentation` | JWT | Lista las documentaciones pertenecientes al usuario en sesión. |
| `GET` | `/api/documentation/:id` | JWT | Retorna el contenido de la documentación técnica y metadatos de alcance. |
| `DELETE` | `/api/documentation/:id` | JWT | Elimina permanentemente una documentación perteneciente al usuario. |
| `GET` | `/api/integrations/notion/auth-url` | JWT | Genera la URL de autorización OAuth de Notion con state firmado. |
| `POST` | `/api/integrations/notion/callback` | JWT | Canjea el código de Notion, guarda el token cifrado y vincula el workspace. |
| `GET` | `/api/integrations/notion/status` | JWT | Informa si el usuario tiene conectado un espacio de Notion `{ connected, workspaceName }`. |
| `GET` | `/api/integrations/notion/pages` | JWT | Lista las páginas de Notion compartidas con la integración. |
| `DELETE` | `/api/integrations/notion` | JWT | Desvincula y elimina las credenciales almacenadas de Notion. |
| `POST` | `/api/export/notion` | JWT | Exporta una documentación como página estructurada en Notion. |
| `GET` | `/api/users/profile` | JWT | Consulta la información detallada del perfil y conteo de análisis. |
| `DELETE` | `/api/users/account` | JWT | Elimina la cuenta del usuario y todas sus documentaciones asociadas. |

---

## 🔍 Alcance y Limitaciones

- **Tamaño de Repositorio:** El microservicio analiza hasta **20 archivos prioritarios** con un límite de **6.000 caracteres por archivo** y un paquete total máximo de **80.000 caracteres**. Los repositorios extensos se documentan de forma condensada y se señala el indicador `truncated: true`.
- **Modo Demo:** Los usuarios en modo demo cuentan con un límite estricto de **2 análisis** y sus datos expiran automáticamente tras 24 horas. La exportación a Notion se encuentra restringida para sesiones demo.
- **Límites de Notion:** La exportación a Notion pagina automáticamente los bloques en lotes de hasta 100 elementos y subdivide párrafos de más de 2.000 caracteres para asegurar total conformidad con la API oficial de Notion.

---

## 🚀 Puesta en Marcha Local

### 1. Iniciar Base de Datos y Redis
```bash
docker compose up -d mongo redis
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Ejecutar en Modo Desarrollo
```bash
npm run start:dev
```
La API estará disponible en `http://localhost:3001/api`.

---

## 🧪 Pruebas y Calidad de Código

```bash
# Pruebas unitarias y de integración
npm test

# Linter rápido con Oxlint
npm run lint

# Compilación de producción
npm run build
```
