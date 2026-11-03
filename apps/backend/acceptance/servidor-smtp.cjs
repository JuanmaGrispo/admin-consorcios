const net = require('node:net');

/** Receptor local de prueba: conserva aceptaciones, sin entregar correo real. */
module.exports = async function smtp() {
  const mensajes = [];
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 smtp.local ESMTP\r\n');
    let buffer = '', data = false, contenido = '', auth = false;
    socket.on('data', (bytes) => {
      buffer += bytes.toString();
      while (buffer.includes('\r\n')) {
        const indice = buffer.indexOf('\r\n');
        const linea = buffer.slice(0, indice); buffer = buffer.slice(indice + 2);
        if (data) {
          if (linea === '.') { data = false; mensajes.push(contenido); contenido = ''; socket.write('250 Accepted\r\n'); }
          else contenido += linea + '\r\n';
        } else if (auth) { auth = false; socket.write('235 Authenticated\r\n'); }
        else if (/^(EHLO|HELO)/i.test(linea)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH /i.test(linea)) { if (linea.split(' ').length >= 3) socket.write('235 Authenticated\r\n'); else { auth = true; socket.write('334 \r\n'); } }
        else if (/^DATA/i.test(linea)) { data = true; socket.write('354 End with dot\r\n'); }
        else if (/^QUIT/i.test(linea)) socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
    socket.on('error', () => undefined);
  });
  await new Promise((r) => server.listen(0, '0.0.0.0', r));
  return { puerto: server.address().port, mensajes, cerrar: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(r); }) };
};
