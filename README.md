# CodeScribe AI — Backend Service

> **Microservicio Backend y Motor de Orquestación de Tareas desarrollado con NestJS 12, TypeScript, BullMQ, Redis y MongoDB.**

---

## 🚀 Descripción del Proyecto

El **Backend de CodeScribe AI** gestiona el ciclo de vida completo de análisis y documentación de repositorios:
- **Autenticación con GitHub OAuth & Modo Demo:** Gestión de sesiones seguras mediante JWT y almacenamiento de tokens de GitHub cifrados con AES-256-CBC.
- **Encolamiento Asíncrono con BullMQ y Redis:** Procesamiento en segundo plano de tareas pesadas de inspección y llamadas a LLMs sin bloquear la API REST.
- **Streaming en Tiempo Real con Server-Sent Events (SSE):** Notificación continua del progreso del análisis hacia el cliente cada 2 segundos.
- **Integración Segura con el Servicio de IA:** Comunicación HTTP resiliente con reintentos y retroceso exponencial hacia `documentador-ai-service`.
- **Persistencia en MongoDB con Mongoose 9:** Modelos tipados para usuarios, repositorios, tareas (`jobs`) y documentos generados.

---

## 🛠️ Stack Tecnológico

- **Framework:** [NestJS](https://nestjs.com/) v12.0
- **Runtime:** Node.js (v20+) con TypeScript
- **Base de Datos NoSQL:** MongoDB 7.0 + Mongoose 9.10
- **Cola de Mensajes & Caché:** Redis 7.0 + BullMQ 6.3 + ioredis 6.0
- **Seguridad & Autenticación:** Passport.js (`passport-github2`, `passport-jwt`), Helmet, `@nestjs/throttler`, crypto nativo (AES-256)
- **Pruebas y Linting:** Vitest 4.1, Supertest, Oxlint

---

## 📁 Estructura del Código Fuente

```text
src/
├── common/             # Filtros de excepción, guardias JWT, decoradores y cifrado AES-256
├── config/             # Configuración centralizada de variables de entorno
├── database/           # Módulo de conexión a MongoDB
├── modules/
│   ├── ai-gateway/     # Cliente HTTP con reintentos hacia documentador-ai-service
│   ├── auth/           # OAuth de GitHub, Modo Demo y emisión de JWT
│   ├── documentation/  # Controlador y servicio de consulta y eliminación de documentos
│   ├── jobs/           # Procesador BullMQ y endpoint SSE de streaming en tiempo real
│   ├── repository/     # Registro y validación de repositorios de GitHub
│   └── users/          # Gestión de perfiles y credenciales de usuario
└── main.ts             # Arranque de la aplicación, configuración de CORS, Helmet y Pipes
```

---

## ⚙️ Configuración del Entorno (`.env`)

Crea un archivo `.env` en la raíz de `documentador-backend`:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Base de datos
MONGODB_URI=mongodb://127.0.0.1:27017/codescribe

# Autenticación JWT
JWT_SECRET=super_secret_jwt_key_codescribe
JWT_EXPIRES_IN=7d

# GitHub OAuth 2.0
GITHUB_CLIENT_ID=tu_github_client_id
GITHUB_CLIENT_SECRET=tu_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback

# Cola de tareas Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Comunicación con Servicio de IA
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_SECRET=shared_secret

# Cifrado simétrico de tokens (32 caracteres)
GITHUB_TOKEN_ENCRYPTION_KEY=12345678901234567890123456789012

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

---

## 🚀 Puesta en Marcha

### 1. Iniciar Base de Datos y Redis
```bash
docker compose up -d
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

## 📡 Endpoints de la API

| Verbo | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/auth/github` | Pública | Redirige al inicio de sesión con GitHub |
| `GET` | `/api/auth/github/callback` | Pública | Callback de OAuth (emite JWT y redirige al frontend) |
| `POST` | `/api/auth/demo` | Pública | Login instantáneo con usuario de prueba |
| `GET` | `/api/auth/me` | JWT | Retorna el perfil del usuario en sesión |
| `POST` | `/api/repositories/analyze` | JWT | Valida repositorio y encola tarea de análisis |
| `GET` | `/api/jobs/:id/stream` | JWT | Stream SSE con eventos de progreso cada 2 segundos |
| `GET` | `/api/documentation` | JWT | Lista todas las documentaciones del usuario |
| `GET` | `/api/documentation/:id` | JWT | Obtiene una documentación por ID |
| `DELETE` | `/api/documentation/:id` | JWT | Elimina permanentemente un documento |

---

## 🧪 Pruebas y Calidad de Código

```bash
# Pruebas unitarias
npm run test

# Pruebas con cobertura
npm run test:cov

# Pruebas de integración E2E
npm run test:e2e

# Linter rápido con Oxlint
npm run lint

# Formateo con Prettier
npm run format
```
