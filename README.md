# Tech Blog - API Backend

Este repositorio contiene la API REST para la plataforma Tech Blog, desarrollada con **Node.js**, **Express**, **TypeScript** y **Socket.io**. Incluye mecanismos de seguridad basados en los estándares **OWASP Top 10** y **ASVS**.

---

## Requisitos Previos

Asegúrate de tener instalados los siguientes componentes:
* **Node.js**: Versión 18 o superior (probado en Node.js `v18.20.5`)
* **npm**: Gestor de paquetes integrado con Node.js

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

## 3. Ejecución

Puedes arrancar el servidor en modo de desarrollo o en modo producción:

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
* **WebSocket**: Integrado bajo el mismo puerto.

---

## 4. Ejecución de Pruebas de Integración

El proyecto incluye un arnés de pruebas automatizadas que verifica el comportamiento del backend (Login, Registro, Autenticación JWT, Cambio de Contraseña y Feed de comentarios). 

Para correr las pruebas:

```bash
npm test
```
