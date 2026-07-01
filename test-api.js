const { spawn } = require('child_process');
const path = require('path');

const BACKEND_PORT = 3000;
const BASE_URL = `http://localhost:${BACKEND_PORT}`;

async function runTests() {
  console.log('--- INICIANDO PRUEBAS AUTOMATIZADAS DE API ---');
  let token = '';

  const assertStatus = (name, res, expectedStatus) => {
    if (res.status === expectedStatus) {
      console.log(`[PASS] ${name} (Status: ${res.status})`);
      return true;
    } else {
      console.error(`[FAIL] ${name} (Esperado: ${expectedStatus}, Recibido: ${res.status})`);
      return false;
    }
  };

  try {
    // -------------------------------------------------------------
    // Escenarios de prueba: /login
    // -------------------------------------------------------------
    console.log('\nPruebas para /login:');

    // a. Acceso proporcionando credenciales correctas
    let loginOk = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'joseph', password: 'password123' })
    });
    assertStatus('/login - Credenciales correctas', loginOk, 200);
    const loginData = await loginOk.json();
    if (loginData.access_token && loginData.token_type === 'Bearer' && loginData.expiration) {
      console.log('   ↳ Estructura de respuesta correcta (access_token, token_type, expiration)');
      token = loginData.access_token;
    } else {
      console.error('   ↳ Estructura de respuesta INCORRECTA:', loginData);
    }

    // b. Acceso proporcionando credenciales erroneas
    let loginWrong = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'joseph', password: 'wrongpassword' })
    });
    assertStatus('/login - Credenciales erróneas', loginWrong, 401);

    // c. Acceso sin proporcionar datos
    let loginEmpty = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assertStatus('/login - Sin datos', loginEmpty, 400);

    // -------------------------------------------------------------
    // Escenarios de prueba: /register
    // -------------------------------------------------------------
    console.log('\nPruebas para /register:');

    // a. Proporcionando todos los datos de manera correcta (Nombre, Correo, Usuario, contraseña y foto de perfil)
    const registerFormData = new FormData();
    registerFormData.append('name', 'Roberto Gomez');
    registerFormData.append('email', 'roberto@example.com');
    registerFormData.append('username', 'roberto');
    registerFormData.append('password', 'password123');
    // Usar un blob de PNG transparente simple de 1x1 para la foto de perfil
    const pngBlob = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' });
    registerFormData.append('avatar', pngBlob, 'profile.png');

    let registerOk = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      body: registerFormData
    });
    assertStatus('/register - Registro correcto', registerOk, 201);
    const registerData = await registerOk.json();
    if (registerData.redirectTo === '/login') {
      console.log('   ↳ Retorna información de redirección al login');
    } else {
      console.error('   ↳ Redirección ausente en la respuesta:', registerData);
    }

    // a2. Registro correcto sin enviar archivo de avatar (debe tomar avatar por defecto)
    const registerNoAvatarForm = new FormData();
    registerNoAvatarForm.append('name', 'Maria Gomez');
    registerNoAvatarForm.append('email', 'maria@example.com');
    registerNoAvatarForm.append('username', 'maria');
    registerNoAvatarForm.append('password', 'password123');

    let registerNoAvatarOk = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      body: registerNoAvatarForm
    });
    assertStatus('/register - Registro correcto sin avatar (Opcional)', registerNoAvatarOk, 201);

    // b. Proporcionando datos No válidos (Números en el nombre, correo sin estructura, etc)
    const badRegForm1 = new FormData();
    badRegForm1.append('name', 'Roberto123'); // Nombre no válido
    badRegForm1.append('email', 'roberto@example.com');
    badRegForm1.append('username', 'roberto_bad1');
    badRegForm1.append('password', 'password123');
    badRegForm1.append('avatar', pngBlob, 'profile.png');

    let registerBadName = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      body: badRegForm1
    });
    assertStatus('/register - Nombre con números (invalido)', registerBadName, 400);

    const badRegForm2 = new FormData();
    badRegForm2.append('name', 'Roberto Gomez');
    badRegForm2.append('email', 'roberto-sin-arroba.com'); // Correo no válido
    badRegForm2.append('username', 'roberto_bad2');
    badRegForm2.append('password', 'password123');
    badRegForm2.append('avatar', pngBlob, 'profile.png');

    let registerBadEmail = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      body: badRegForm2
    });
    assertStatus('/register - Email sin estructura (invalido)', registerBadEmail, 400);

    // c. Sin proporcionar datos
    let registerEmpty = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      body: new FormData()
    });
    assertStatus('/register - Sin datos', registerEmpty, 400);

    // -------------------------------------------------------------
    // Escenarios de prueba: /me
    // -------------------------------------------------------------
    console.log('\nPruebas para /me:');

    // a. Acceso con todos los datos necesarios (cabeceras correctas)
    let meOk = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assertStatus('/me - Token correcto', meOk, 200);
    const meData = await meOk.json();
    if (meData.username === 'joseph' && meData.email === 'joseph@example.com' && meData.name === 'Joseph Dev') {
      console.log('   ↳ Retorna información del usuario correcta');
    } else {
      console.error('   ↳ Información del usuario INCORRECTA:', meData);
    }

    // b. Acceso sin cabeceras
    let meNoHeader = await fetch(`${BASE_URL}/me`, {
      method: 'GET'
    });
    assertStatus('/me - Sin cabeceras (Debe ser 400)', meNoHeader, 400);

    // c. Acceso con datos de cabecera incorrectos/inválidos
    let meBadHeader = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer token-invalido-12345' }
    });
    assertStatus('/me - Cabeceras incorrectas/invalidas', meBadHeader, 401);

    // -------------------------------------------------------------
    // Escenarios de prueba: /change-password
    // -------------------------------------------------------------
    console.log('\nPruebas para /change-password:');

    // a. Solicitud con todos los datos correctos
    let changePwOk = await fetch(`${BASE_URL}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ oldPassword: 'password123', newPassword: 'newpassword123' })
    });
    assertStatus('/change-password - Datos y cabeceras correctas', changePwOk, 200);
    const changePwData = await changePwOk.json();
    console.log('   ↳ Retroalimentación:', changePwData);

    // Revertir la contraseña para el resto de las pruebas o futuros inicios de sesión
    await fetch(`${BASE_URL}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ oldPassword: 'newpassword123', newPassword: 'password123' })
    });

    // b. Acceso sin cabeceras
    let changePwNoHeader = await fetch(`${BASE_URL}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: 'password123', newPassword: 'newpassword123' })
    });
    assertStatus('/change-password - Sin cabeceras (Debe ser 403)', changePwNoHeader, 403);

    // c. Acceso con datos de cabecera incorrectos/inválidos
    let changePwBadHeader = await fetch(`${BASE_URL}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token-invalido-12345'
      },
      body: JSON.stringify({ oldPassword: 'password123', newPassword: 'newpassword123' })
    });
    assertStatus('/change-password - Cabeceras incorrectas/invalidas', changePwBadHeader, 401);

    // -------------------------------------------------------------
    // Escenarios de prueba: /feed
    // -------------------------------------------------------------
    console.log('\nPruebas para /feed:');

    // a. Solicitud (listado de comentarios) con todos los datos correctos
    let getFeedOk = await fetch(`${BASE_URL}/feed`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assertStatus('/feed (GET) - Cabeceras correctas', getFeedOk, 200);
    const feedList = await getFeedOk.json();
    console.log(`   ↳ Total comentarios listados: ${feedList.length}`);

    // b. Acceso sin cabeceras (listado de comentarios)
    let getFeedNoHeader = await fetch(`${BASE_URL}/feed`, { method: 'GET' });
    assertStatus('/feed (GET) - Sin cabeceras (Debe ser 403)', getFeedNoHeader, 403);

    // c. Acceso con datos de cabecera incorrectos/inválidos (listado de comentarios)
    let getFeedBadHeader = await fetch(`${BASE_URL}/feed`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer token-invalido-12345' }
    });
    assertStatus('/feed (GET) - Cabeceras incorrectas/invalidas', getFeedBadHeader, 401);

    // d. Solicitud (creación de comentarios) con todos los datos correctos
    let postFeedOk = await fetch(`${BASE_URL}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content: 'Este es un comentario de prueba automatizado.' })
    });
    assertStatus('/feed (POST) - Creación correcta', postFeedOk, 200);
    const feedPostData = await postFeedOk.json();
    console.log('   ↳ Retroalimentación:', feedPostData);

    // e. Acceso sin cabeceras (creación de comentarios)
    let postFeedNoHeader = await fetch(`${BASE_URL}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Intento sin cabecera.' })
    });
    assertStatus('/feed (POST) - Sin cabeceras (Debe ser 403)', postFeedNoHeader, 403);

    // f. Acceso con datos de cabecera incorrectos/inválidos (creación de comentarios)
    let postFeedBadHeader = await fetch(`${BASE_URL}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token-invalido-12345'
      },
      body: JSON.stringify({ content: 'Intento con cabecera incorrecta.' })
    });
    assertStatus('/feed (POST) - Cabeceras incorrectas/invalidas', postFeedBadHeader, 401);

    console.log('\n--- PRUEBAS AUTOMATIZADAS FINALIZADAS ---');

  } catch (error) {
    console.error('Error durante la ejecución del test:', error);
  }
}

// Iniciar el backend como proceso secundario
console.log('Iniciando el servidor backend para pruebas...');
const devServer = spawn('npx', ['ts-node', 'src/index.ts'], {
  cwd: __dirname,
  env: { ...process.env, PORT: BACKEND_PORT },
  shell: true
});

devServer.stdout.on('data', async (data) => {
  const output = data.toString();
  console.log(`[SERVER]: ${output.trim()}`);
  if (output.includes('Servidor Express corriendo')) {
    // Esperar 500 ms adicionales para asegurar que el puerto HTTP se vincule por completo
    setTimeout(async () => {
      await runTests();
      console.log('Apagando el servidor...');
      devServer.kill();
      process.exit(0);
    }, 500);
  }
});

devServer.stderr.on('data', (data) => {
  console.error(`[SERVER ERROR]: ${data.toString().trim()}`);
});

devServer.on('close', (code) => {
  console.log(`Servidor detenido con código: ${code}`);
});

// Respaldo de seguridad para forzar la salida
setTimeout(() => {
  console.error('Límite de tiempo de prueba alcanzado (30 segundos). Forzando cierre.');
  devServer.kill();
  process.exit(1);
}, 30000);
