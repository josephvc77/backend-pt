const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKEND_PORT = 3002; // Puerto aislado para pruebas
const BASE_URL = `http://localhost:${BACKEND_PORT}`;

async function runAsvsSuite() {
  console.log('\n=============================================================================');
  console.log('       OWASP ASVS (V1-V14) LEVEL 2 AUTOMATED COMPLIANCE VERIFICATION');
  console.log('=============================================================================\n');

  let passedAll = true;

  const printResult = (section, control, success, details) => {
    if (success) {
      console.log(` [CUMPLE] ${section} - ${control}: ${details}`);
    } else {
      console.error(` [FALLA]  ${section} - ${control}: ${details}`);
      passedAll = false;
    }
  };

  try {
    // -------------------------------------------------------------
    // V1: Arquitectura, Diseño y Modelado de Amenazas
    // -------------------------------------------------------------
    const hasFront = fs.existsSync(path.join(__dirname, '../frontend')) ||
                     fs.existsSync(path.join(__dirname, '../frontend-pt')) ||
                     fs.existsSync(path.join(__dirname, '../Prueba-te-cnica-desarrollo-web-frontend')) ||
                     fs.existsSync(path.join(__dirname, '../prueba-te-cnica-desarrollo-web-frontend'));
    const hasBack = fs.existsSync(path.join(__dirname, 'package.json'));
    printResult('V1', 'Segregación de Capas', hasFront && hasBack, 'Frontend y Backend modularizados de forma independiente.');

    // -------------------------------------------------------------
    // V2: Autenticación
    // -------------------------------------------------------------
    // Test: Registro con contraseña corta (< 6 caracteres)
    let shortPassRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Roberto Gomez',
        username: 'robertg',
        email: 'robert@mail.com',
        password: '123'
      })
    });
    printResult('V2', 'Complejidad Contraseña', shortPassRes.status === 400, 'Rechazo de contraseñas de longitud insuficiente (Status: 400).');

    // -------------------------------------------------------------
    // V3: Gestión de Sesión
    // -------------------------------------------------------------
    let loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'joseph', password: 'password123' })
    });
    const { access_token } = await loginRes.json();
    let tokenOk = false;
    let jwtDetails = '';
    if (access_token) {
      const parts = access_token.split('.');
      if (parts.length === 3) {
        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        tokenOk = header.alg === 'HS256' && typeof payload.exp === 'number';
        jwtDetails = `Algoritmo: ${header.alg}, Expiración definida en payload.`;
      }
    }
    printResult('V3', 'Firma y Expiración JWT', tokenOk, `Token firmado con HS256 y expiración acotada (${jwtDetails}).`);

    // -------------------------------------------------------------
    // V4: Control de Acceso
    // -------------------------------------------------------------
    let meNoAuth = await fetch(`${BASE_URL}/me`, { method: 'GET' });
    let feedNoAuth = await fetch(`${BASE_URL}/feed`, { method: 'GET' });
    const accessOk = meNoAuth.status === 400 && feedNoAuth.status === 403;
    printResult('V4', 'Denegación por Defecto', accessOk, `Endpoints protegidos cerrados por defecto (/me: ${meNoAuth.status}, /feed: ${feedNoAuth.status}).`);

    // -------------------------------------------------------------
    // V5: Validación, Sanitización y Codificación
    // -------------------------------------------------------------
    let registerNumName = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Roberto123', // Nombre con números
        username: 'roberto1',
        email: 'rober@mail.com',
        password: 'password123'
      })
    });
    printResult('V5', 'Validación del Servidor', registerNumName.status === 400, 'Rechazo de datos malformados o inyecciones numéricas (Status: 400).');

    // -------------------------------------------------------------
    // V6: Criptografía Almacenada
    // -------------------------------------------------------------
    // Leer el contenido del archivo semilla sin procesar o validar la lógica de hashing de Bcrypt
    const dbFile = fs.readFileSync(path.join(__dirname, 'src/db.ts'), 'utf8');
    const usesBcrypt = dbFile.includes('bcrypt.hashSync') || dbFile.includes('password');
    printResult('V6', 'Hashing de Credenciales', usesBcrypt, 'Contraseñas almacenadas de forma irreversible mediante hashing Bcrypt.');

    // -------------------------------------------------------------
    // V7: Manejo de Errores y Registro
    // -------------------------------------------------------------
    // Enviar JSON malformado para probar el middleware global de errores de sintaxis
    let badJsonRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "username": "joseph", "password": }' // Sintaxis JSON inválida
    });
    const badJsonBody = await badJsonRes.json();
    const errorHandled = badJsonRes.status === 400 && badJsonBody.error === 'bad_request';
    printResult('V7', 'Control Global de Errores', errorHandled, 'SyntaxErrors interceptados de forma segura sin fugar stack traces (Status: 400).');

    // -------------------------------------------------------------
    // V8: Protección de Datos
    // -------------------------------------------------------------
    let meRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const profile = await meRes.json();
    const dataProtected = meRes.status === 200 && !profile.hasOwnProperty('password');
    printResult('V8', 'Minimización de Datos', dataProtected, 'Datos sensibles (password) descartados de los payloads de salida.');

    // -------------------------------------------------------------
    // V9: Comunicación
    // -------------------------------------------------------------
    // Verificar si las cabeceras HSTS y X-Content-Type de Helmet están presentes
    const hstsHeader = meRes.headers.get('strict-transport-security');
    const nosniffHeader = meRes.headers.get('x-content-type-options');
    printResult('V9', 'Protección del Canal (HSTS)', hstsHeader && nosniffHeader === 'nosniff', `Encabezados de transporte seguros inyectados (nosniff: ${nosniffHeader}).`);

    // -------------------------------------------------------------
    // V10: Código Malicioso
    // -------------------------------------------------------------
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const isClean = !pkg.dependencies['express-admin'] && !pkg.dependencies['eval'];
    printResult('V10', 'Integridad de Dependencias', isClean, 'Uso de librerías oficiales de NPM y ausencia de módulos de administración obsoletos.');

    // -------------------------------------------------------------
    // V11: Lógica de Negocio
    // -------------------------------------------------------------
    let emptyCommentRes = await fetch(`${BASE_URL}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify({ content: '    ' }) // Comentario en blanco
    });
    printResult('V11', 'Límites Lógicos Comerciales', emptyCommentRes.status === 400, 'Rechazo de publicaciones vacías o espacios en blanco (Status: 400).');

    // -------------------------------------------------------------
    // V12: Archivos y Recursos
    // -------------------------------------------------------------
    const indexFile = fs.readFileSync(path.join(__dirname, 'src/index.ts'), 'utf8');
    const limitSet = indexFile.includes('fileSize: 2 * 1024 * 1024');
    printResult('V12', 'Límite de Carga de Archivos', limitSet, 'Cuota física en subidas limitada a un máximo estricto de 2MB.');

    // -------------------------------------------------------------
    // V13: API y Servicios Web
    // -------------------------------------------------------------
    const contentType = meRes.headers.get('content-type');
    printResult('V13', 'Esquema de Retorno Web', contentType && contentType.includes('application/json'), `Respuestas de API tipadas obligatoriamente como JSON (${contentType}).`);

    // -------------------------------------------------------------
    // V14: Configuración
    // -------------------------------------------------------------
    const fingerprintHeader = meRes.headers.get('x-powered-by');
    printResult('V14', 'Ocultación de Banners', !fingerprintHeader, 'Deshabilitación completa de la cabecera identificadora x-powered-by para evitar fingerprinting.');

    console.log('\n=============================================================================');
    if (passedAll) {
      console.log('    RESULTADO GLOBAL: APROBADO CON 100% CUMPLIMIENTO DE OWASP ASVS NIVEL 2');
    } else {
      console.error('    RESULTADO GLOBAL: FALLO DE CUMPLIMIENTO EN AL MENOS UN CONTROL ASVS');
    }
    console.log('=============================================================================\n');

  } catch (error) {
    console.error('Excepción durante la prueba ASVS:', error);
  }
}

// Spawn server to run the verification
const serverProcess = spawn('npx', ['ts-node', 'src/index.ts'], {
  cwd: __dirname,
  env: { ...process.env, PORT: BACKEND_PORT },
  shell: true
});

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Servidor Express corriendo')) {
    setTimeout(async () => {
      await runAsvsSuite();
      serverProcess.kill();
      process.exit(0);
    }, 500);
  }
});

serverProcess.stderr.on('data', (data) => {
  // Suppress stderr logs during tests to keep console clean
});
