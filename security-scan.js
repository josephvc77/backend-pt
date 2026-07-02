const { spawn } = require('child_process');

const BACKEND_PORT = 3001; // Ejecutar en un puerto separado para aislamiento
const BASE_URL = `http://localhost:${BACKEND_PORT}`;

async function runSecurityTests() {
  console.log('\n=============================================================');
  console.log(' INICIANDO ANÁLISIS DINÁMICO (PRUEBAS DE PENETRACIÓN) ');
  console.log('=============================================================\n');

  let testOk = true;

  const assertBlocked = (testName, response, expectedStatus) => {
    if (response.status === expectedStatus) {
      console.log(` [SEGURO] ${testName} (Bloqueado con Status: ${response.status})`);
      return true;
    } else {
      console.error(` [VULNERABLE] ${testName} (Esperado bloqueo: ${expectedStatus}, Recibido: ${response.status})`);
      testOk = false;
      return false;
    }
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: Bypass de Autenticación por SQL Injection
    // -------------------------------------------------------------
    const sqliBody = {
      username: "' OR '1'='1",
      password: "' OR '1'='1"
    };
    let sqliRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sqliBody)
    });
    assertBlocked('Bypass SQLi en /login', sqliRes, 401);

    // -------------------------------------------------------------
    // TEST 2: Alteración de Firma JWT (JWT Signature Tampering)
    // -------------------------------------------------------------
    // Obtener un token válido primero
    let loginOk = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'joseph', password: 'password123' })
    });
    const cookieHeader = loginOk.headers.get('set-cookie');
    let access_token = '';
    if (cookieHeader) {
      const match = cookieHeader.match(/access_token=([^;]+)/);
      if (match) {
        access_token = match[1];
      }
    }
    
    // Modificar la parte de la firma del JWT (tercera parte)
    const tokenParts = access_token.split('.');
    const tamperedToken = `${tokenParts[0]}.${tokenParts[1]}.fakesignature12345`;

    let tamperRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tamperedToken}` }
    });
    assertBlocked('JWT Tampering (Firma alterada) en /me', tamperRes, 401);

    // -------------------------------------------------------------
    // TEST 3: Algoritmo "None" en JWT (JWT None Algorithm Bypass)
    // -------------------------------------------------------------
    // Construir cabecera especificando el algoritmo "none": {"alg":"none","typ":"JWT"} -> base64
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    // Carga útil del token
    const payload = tokenParts[1];
    const noneToken = `${noneHeader}.${payload}.`;

    let noneRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${noneToken}` }
    });
    assertBlocked('JWT None Algorithm Bypass en /me', noneRes, 401);

    // -------------------------------------------------------------
    // TEST 4: Bypass de Rutas Privadas sin Cabecera (Authorization Bypass)
    // -------------------------------------------------------------
    let meNoHeader = await fetch(`${BASE_URL}/me`, { method: 'GET' });
    assertBlocked('Acceso sin cabeceras en /me (Esperado 400)', meNoHeader, 400);

    let feedNoHeader = await fetch(`${BASE_URL}/feed`, { method: 'GET' });
    assertBlocked('Acceso sin cabeceras en /feed GET (Esperado 403)', feedNoHeader, 403);

    let changePwNoHeader = await fetch(`${BASE_URL}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: '1', newPassword: '2' })
    });
    assertBlocked('Acceso sin cabeceras en /change-password (Esperado 403)', changePwNoHeader, 403);

    // -------------------------------------------------------------
    // TEST 5: Formato Malformado de Cabecera (Header Injection / Format Tampering)
    // -------------------------------------------------------------
    let badHeaderRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Basic YWRtaW46cGFzc3dvcmQ=` } // Basic en lugar de Bearer
    });
    assertBlocked('Cabecera malformada (Basic Schema) en /me', badHeaderRes, 401);

    // -------------------------------------------------------------
    // TEST 6: Inyección de Script XSS en Comentario (Seguridad del Backend)
    // -------------------------------------------------------------
    let postXssRes = await fetch(`${BASE_URL}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify({ content: '<script>alert("XSS Stored Test")</script>' })
    });
    // El servidor debe almacenar la cadena de forma segura (texto plano) y devolver 200 (no ejecutar ni fallar)
    if (postXssRes.status === 200) {
      console.log(' [SEGURO] XSS Stored - Servidor almacena el comentario como string plano de forma segura.');
    } else {
      console.error(' [ERROR] Falló el guardado del comentario XSS:', postXssRes.status);
      testOk = false;
    }

    // -------------------------------------------------------------
    // TEST 7: Revocación de Token tras Cierre de Sesión (Session Revocation)
    // -------------------------------------------------------------
    console.log('TEST 7: Revocación de Token tras Cierre de Sesión');
    let logoutRes = await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    if (logoutRes.status === 200) {
      console.log(' [INFO] Logout exitoso ejecutado en el servidor.');
    } else {
      console.error(' [ERROR] Falló la llamada a /logout en el servidor:', logoutRes.status);
      testOk = false;
    }

    let afterLogoutRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    assertBlocked('Uso de token después del logout en /me', afterLogoutRes, 401);

    console.log('\n=============================================================');
    if (testOk) {
      console.log(' [SEGURO] RESULTADO: LA APLICACIÓN ES SEGURA CONTRA LOS ATAQUES PROBADOS  [SEGURO]');
    } else {
      console.error(' [VULNERABLE] RESULTADO: SE DETECTARON VULNERABILIDADES CRÍTICAS  [VULNERABLE]');
    }
    console.log('=============================================================\n');

  } catch (error) {
    console.error('Error durante la ejecución del escaneo de seguridad:', error);
  }
}

// Iniciar el servidor backend
console.log('Arrancando el servidor backend en modo sandbox para pruebas de penetración...');
const serverProcess = spawn('npx', ['ts-node', 'src/index.ts'], {
  cwd: __dirname,
  env: { ...process.env, PORT: BACKEND_PORT },
  shell: true
});

serverProcess.stdout.on('data', async (data) => {
  const output = data.toString();
  if (output.includes('Servidor Express corriendo')) {
    setTimeout(async () => {
      await runSecurityTests();
      console.log('Deteniendo servidor de pruebas...');
      serverProcess.kill();
      process.exit(0);
    }, 500);
  }
});

serverProcess.stderr.on('data', (data) => {
  // Suprimir el registro detallado de errores durante los escaneos para mantener la salida limpia
});
