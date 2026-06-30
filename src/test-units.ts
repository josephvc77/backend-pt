import assert from 'assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { JWT_SECRET } from './auth.middleware';

function runUnitTests(): void {
  console.log('\n=============================================================');
  console.log('  INICIANDO PRUEBAS UNITARIAS (BACKEND) ');
  console.log('=============================================================\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Verificación de Hashing con Bcryptjs
    // -------------------------------------------------------------
    const rawPassword = 'my-secure-password-123';
    const hash = bcrypt.hashSync(rawPassword, 10);
    assert.ok(bcrypt.compareSync(rawPassword, hash), 'Bcrypt debe verificar contraseñas correctas');
    assert.ok(!bcrypt.compareSync('wrong-password', hash), 'Bcrypt debe rechazar contraseñas incorrectas');
    console.log(' Test Unitario 1: Hashing de contraseñas Bcrypt verificado.');

    // -------------------------------------------------------------
    // Test 2: Codificación y Verificación de JWT
    // -------------------------------------------------------------
    const payload = { userId: 'u99', username: 'tester' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: 60 });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    assert.strictEqual(decoded.userId, payload.userId, 'JWT debe guardar el userId');
    assert.strictEqual(decoded.username, payload.username, 'JWT debe guardar el username');
    console.log(' Test Unitario 2: Emisión y decodificación de tokens JWT verificado.');

    // -------------------------------------------------------------
    // Test 3: Creación y Lectura de Usuarios en Base de Datos
    // -------------------------------------------------------------
    db.createUser({
      name: 'Test User',
      email: 'test@example.com',
      username: 'newtester',
      password: hash,
      avatar: '/uploads/test.png'
    });
    const retrievedUser = db.findUserByUsername('newtester');
    assert.ok(retrievedUser, 'El usuario debe poder recuperarse por nombre de usuario');
    assert.strictEqual(retrievedUser?.name, 'Test User', 'El nombre recuperado debe coincidir');
    assert.strictEqual(retrievedUser?.email, 'test@example.com', 'El email recuperado debe coincidir');
    console.log(' Test Unitario 3: Alta y lectura de usuarios en base de datos verificado.');

    // -------------------------------------------------------------
    // Test 4: Creación de Comentario y Ordenamiento del Feed
    // -------------------------------------------------------------
    const initialCommentsCount = db.getComments().length;
    const newComment = db.addComment('u1', 'Contenido del comentario de prueba unitaria');
    assert.ok(newComment, 'Crear comentario debe retornar el nuevo objeto de comentario');
    
    const updatedComments = db.getComments();
    assert.strictEqual(updatedComments.length, initialCommentsCount + 1, 'El conteo de comentarios debe aumentar en 1');
    assert.strictEqual(updatedComments[0].id, newComment?.id, 'El comentario más nuevo debe aparecer en el tope del feed');
    console.log(' Test Unitario 4: Publicación e inserción de comentarios en el feed verificado.');

    // -------------------------------------------------------------
    // Test 5: Actualización de Contraseña en BD
    // -------------------------------------------------------------
    const newHashed = bcrypt.hashSync('new-pw-99', 10);
    db.updateUserPassword('u1', newHashed);
    const updatedUser = db.findUserById('u1');
    assert.strictEqual(updatedUser?.password, newHashed, 'El hash de contraseña debe actualizarse en la BD');
    console.log(' Test Unitario 5: Actualización de contraseña en la base de datos verificado.');

    console.log('\n=============================================================');
    console.log('  RESULTADO: TODAS LAS PRUEBAS UNITARIAS PASARON EXITOSAMENTE ');
    console.log('=============================================================\n');

  } catch (error: any) {
    console.error(' ERROR EN PRUEBAS UNITARIAS:', error.message);
    process.exit(1);
  }
}

runUnitTests();
