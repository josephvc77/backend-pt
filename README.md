# Tech Blog - API Backend

Este repositorio contiene la API REST para la plataforma Tech Blog, desarrollada con **Node.js**, **Express**, **TypeScript** y **Socket.io**. Incluye mecanismos de seguridad basados en los estándares **OWASP Top 10** y **ASVS**.

---

## Requisitos Previos

Asegúrate de tener instalados los siguientes componentes:
* **Node.js**: Versión 18 o superior (probado en Node.js `v18.20.5`)
* **npm**: Gestor de paquetes integrado con Node.js
* **Docker y Docker Compose**: Para ejecución basada en contenedores.

---

## 1. Construcción (Instalación de Dependencias)

Para descargar e instalar todas las dependencias del servidor en el directorio local `node_modules/`, ejecuta:

```bash
npm install
```

Este paso configurará:
* Las dependencias de ejecución principales (`express`, `helmet`, `cors`, `jsonwebtoken`, `bcryptjs`, `multer`, `socket.io`, `express-rate-limit`).
* Las dependencias de desarrollo para tipado de TypeScript y transpilación.

---

## 2. Compilación (Generación del Distribuible)

La aplicación está escrita en **TypeScript** (`.ts`) y debe ser transpilada a código JavaScript nativo (`.js`) para su ejecución óptima en producción.

Para compilar el proyecto:

```bash
npm run build
```

Esto generará la carpeta `dist/` en la raíz del backend conteniendo los archivos listos para ejecución en JavaScript nativo.

---

## 3. Ejecución (Local)

Puedes arrancar el servidor en modo de desarrollo o en modo producción local:

### A. Ejecución en Modo Desarrollo (Recarga Automática)
Para levantar el servidor usando `ts-node-dev`, el cual observa cambios en tiempo real y transpila en caliente:

```bash
npm run dev
```

### B. Ejecución en Modo Producción
Para iniciar el servidor a partir de los archivos ya compilados (debes ejecutar `npm run build` primero):

```bash
npm start
```

El servidor se levantará en:
* **API URL**: [http://localhost:3000](http://localhost:3000)

---

## 4. Ejecución de Pruebas de Integración

Para correr las pruebas automáticas de la API:

```bash
npm test
```

---

## 5. Despliegue en Contenedores (Docker)

El proyecto está diseñado y optimizado para ejecutarse en contenedores mediante un flujo **multi-stage build** en Docker.

### A. Ejecución Individual del Contenedor de Backend
Si deseas construir y ejecutar únicamente la API de backend:

1. **Construir la imagen de Docker**:
   ```bash
   docker build -t tech-blog-backend .
   ```
2. **Ejecutar el contenedor**:
   ```bash
   docker run -d -p 3000:3000 --name blog-api tech-blog-backend
   ```
   *(Esto levantará la API en el puerto 3000 de tu máquina).*

### B. Orquestación Completa (Backend + Frontend)
En el directorio raíz del proyecto se incluye un archivo `docker-compose.yml` para levantar la solución completa con un solo comando.

Desde la carpeta raíz del proyecto, ejecuta:
```bash
docker-compose up --build -d
```

Este comando:
1. Compilará y empaquetará el backend (puerto `3000`).
2. Compilará y servirá el frontend mediante Nginx (puerto `4200` apuntando internamente al puerto `80`).
3. Creará un volumen compartido seguro para gestionar las imágenes de avatar cargadas de forma persistente.
