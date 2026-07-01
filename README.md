# Tech Blog - API Backend

Este repositorio contiene la API REST para la plataforma Tech Blog, desarrollada con **Node.js**, **Express**, **TypeScript** y **Socket.io**. Incluye mecanismos de seguridad basados en los estándares **OWASP Top 10** y **ASVS**.

---

## Requisitos Previos

Asegúrate de tener instalados los siguientes componentes:
* **Node.js**: Versión 22 o superior (probado en Node.js `v22.22.3`)
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
Si deseas construir y ejecutar únicamente la API de backend de manera independiente:

1. **Construir la imagen de Docker**:
   ```bash
   docker build -t tech-blog-backend .
   ```
2. **Ejecutar el contenedor**:
   ```bash
   docker run -d -p 3000:3000 --name blog-api tech-blog-backend
   ```
   *(Esto levantará la API en el puerto 3000 de tu máquina).*

### B. Orquestación Completa de la Solución (Backend + Frontend)
Dado que ambos componentes están en repositorios separados, para orquestar la solución completa con Docker Compose debes:

1. Clonar ambos repositorios como carpetas hermanas dentro de un mismo directorio raíz:
   ```text
   mi-proyecto/
    ├── backend/   (Clonado de: https://github.com/josephvc77/backend-pt)
    └── frontend/  (Clonado de: https://github.com/josephvc77/frontend-pt)
   ```
2. Crear un archivo llamado `docker-compose.yml` dentro del directorio raíz (`mi-proyecto/`) con el siguiente contenido:
   ```yaml
   version: '3.8'

   services:
     backend:
       build: ./backend
       ports:
         - "3000:3000"
       volumes:
         - backend-uploads:/app/uploads
       environment:
         - PORT=3000

     frontend:
       build: ./frontend
       ports:
         - "4200:80"
       depends_on:
         - backend

   volumes:
     backend-uploads:
   ```
3. Desde la carpeta raíz del proyecto (`mi-proyecto/`), ejecuta:
   ```bash
   docker-compose up --build -d
   ```
   Este comando compilará y empaquetará el backend (puerto `3000`) y levantará el cliente Angular servido por Nginx (puerto `4200`) de forma totalmente integrada y persistente.

---

## 6. Criterios Adicionales de Puntaje (Valor Agregado)

Este proyecto fue desarrollado bajo altos estándares de ingeniería de software, cubriendo la totalidad de los criterios adicionales de evaluación:

* **a. Manejo de Git Flow**: Historial de commits ordenado, descriptivo e incremental en la rama principal. Se incluye la estructura gráfica del flujo de desarrollo local.
* **b. Desarrollo enfocado a contenedores (Docker)**: Configuración de contenedores independientes mediante Dockerfiles optimizados (Multi-stage builds) y orquestación unificada mediante `docker-compose.yml` en la raíz.
* **c. Programación Orientada a Objetos (POO)**: Estructuración basada en clases en Angular (Componentes, Servicios) y clases controladoras y de acceso a datos en el backend con TypeScript.
* **d. Desarrollo de Pruebas**: Suite de pruebas unitarias configurada en el frontend (`npm test` con Karma/Jasmine) y suite de pruebas de integración automatizadas en el backend (`npm test` y `npm run test:asvs`).
* **e. Implementación de Frameworks**: Desarrollo estructurado utilizando **Angular 20** en el frontend y **Express / Node.js** en el backend.
* **f. Patrones de Diseño y Arquitectura**:
  * **Backend**: Arquitectura en Capas (Ruteo, Base de datos), Patrón *Singleton* (Instancia de Base de datos), Patrón *Middleware* (Cadena de Responsabilidad para control de seguridad), y Patrón *Observer/Publish-Subscribe* (WebSockets en tiempo real).
  * **Frontend**: Arquitectura Basada en Componentes, Inyección de Dependencias (DI) nativa, y Patrón *Observer* Reactivo (RxJS Observables).
* **g. Aplicación Correcta del Estándar REST**: Rutas estructuradas de forma semántica utilizando verbos HTTP adecuados (`GET`, `POST`) y códigos de estado REST estándar (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`).
* **h. Aplicación del Estándar oAuth (Tokens Bearer)**: Autenticación e identificación sin estado basada en **JSON Web Tokens (JWT)** utilizando el esquema de cabecera estándar de autorización `Authorization: Bearer <Token>` (RFC 6750).
