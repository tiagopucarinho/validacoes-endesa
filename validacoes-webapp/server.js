const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'records.json');

const partners = ['ENDESA', 'INMARK'];
const statusOptions = ['Pendente', 'Nao atendeu', 'Pede reagendamento por indisponibilidade', 'Validado', 'Nao validado', 'Recusa chamada'];

for (const dir of [PUBLIC_DIR, DATA_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]\n', 'utf8');

function readRecords() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeRecords(records) {
  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function text(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(payload);
}

function safeFileName(name) {
  const clean = path.basename(name || 'ficheiro').replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean || 'ficheiro';
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.pdf': 'application/pdf'
  }[ext] || 'application/octet-stream';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) {
        reject(new Error('Ficheiro demasiado grande. Limite: 25 MB.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(buffer, contentTypeHeader) {
  const boundaryMatch = /boundary=(?:(?:"([^"]+)")|([^;]+))/i.exec(contentTypeHeader || '');
  if (!boundaryMatch) throw new Error('Pedido sem boundary multipart.');
  const boundary = Buffer.from('--' + (boundaryMatch[1] || boundaryMatch[2]));
  const parts = [];
  let start = buffer.indexOf(boundary) + boundary.length + 2;

  while (start > boundary.length + 1 && start < buffer.length) {
    const next = buffer.indexOf(boundary, start);
    if (next === -1) break;
    const part = buffer.slice(start, next - 2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headerText = part.slice(0, headerEnd).toString('latin1');
      const body = part.slice(headerEnd + 4);
      const nameMatch = /name="([^"]+)"/i.exec(headerText);
      const fileMatch = /filename="([^"]*)"/i.exec(headerText);
      if (nameMatch) parts.push({ name: nameMatch[1], filename: fileMatch ? fileMatch[1] : '', body });
    }
    start = next + boundary.length + 2;
  }

  const fields = {};
  const files = {};
  for (const part of parts) {
    if (part.filename) files[part.name] = part;
    else fields[part.name] = part.body.toString('utf8');
  }
  return { fields, files };
}

function publicFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return text(res, 403, 'Acesso negado.');
  fs.readFile(filePath, (err, data) => {
    if (err) return text(res, 404, 'Nao encontrado.');
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

function attachmentFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const storedFile = decodeURIComponent(url.pathname.replace('/api/files/', ''));
  if (!storedFile || storedFile.includes('/') || storedFile.includes('\\')) return text(res, 400, 'Ficheiro invalido.');

  const records = readRecords();
  const record = records.find(item => item.storedFile === storedFile);
  if (!record) return text(res, 404, 'Ficheiro nao encontrado.');

  const filePath = path.normalize(path.join(UPLOAD_DIR, storedFile));
  if (!filePath.startsWith(UPLOAD_DIR)) return text(res, 403, 'Acesso negado.');

  fs.readFile(filePath, (err, data) => {
    if (err) return text(res, 404, 'Ficheiro nao encontrado.');
    const displayName = safeFileName(record.fileName || 'documento');
    const encodedName = encodeURIComponent(record.fileName || 'documento');
    res.writeHead(200, {
      'Content-Type': contentType(record.fileName || storedFile),
      'Content-Disposition': `inline; filename="${displayName}"; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, max-age=60'
    });
    res.end(data);
  });
}

function validateRecord(fields) {
  const required = ['contactName', 'nif', 'email', 'phone', 'birthDate', 'contractDate', 'contractType', 'contractedServices', 'paymentOption', 'invoiceMode', 'createdBy'];
  for (const key of required) {
    if (!String(fields[key] || '').trim()) throw new Error(`Campo obrigatorio em falta: ${key}`);
  }
  if (!partners.includes(fields.createdBy)) throw new Error('Parceiro invalido.');
  if (!/^\d{9}$/.test(fields.nif.trim())) throw new Error('O NIF deve ter 9 digitos.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email.trim())) throw new Error('E-mail invalido.');
}

function oppositePartner(partner) {
  return partner === 'ENDESA' ? 'INMARK' : 'ENDESA';
}

function nowIso() {
  return new Date().toISOString();
}

function printableDate(iso) {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, app: 'validacoes-endesa-inmark' });
  }

  if (req.method === 'GET' && url.pathname === '/api/records') {
    return json(res, 200, readRecords());
  }

  if (req.method === 'POST' && url.pathname === '/api/records') {
    try {
      const body = await readBody(req);
      const { fields, files } = parseMultipart(body, req.headers['content-type']);
      validateRecord(fields);

      const timestamp = nowIso();
      const attachment = files.attachment;
      let fileName = 'Sem ficheiro';
      let storedFile = '';

      if (attachment && attachment.filename) {
        fileName = safeFileName(attachment.filename);
        storedFile = `${Date.now()}-${crypto.randomUUID()}-${fileName}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, storedFile), attachment.body);
      }

      const record = {
        id: crypto.randomUUID(),
        contactName: fields.contactName.trim(),
        nif: fields.nif.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
        birthDate: fields.birthDate,
        contractDate: fields.contractDate,
        contractType: fields.contractType,
        contractedServices: fields.contractedServices,
        paymentOption: fields.paymentOption,
        invoiceMode: fields.invoiceMode,
        fileName,
        storedFile,
        status: 'Pendente',
        createdBy: fields.createdBy,
        createdAt: timestamp,
        updatedBy: fields.createdBy,
        updatedAt: timestamp,
        notifications: [`Novo pedido criado. Notificacao enviada para ${oppositePartner(fields.createdBy)}.`],
        history: [{
          date: timestamp,
          partner: fields.createdBy,
          status: 'Pendente',
          comment: fields.initialComment || 'Pedido criado.'
        }]
      };

      const records = readRecords();
      records.unshift(record);
      writeRecords(records);
      return json(res, 201, record);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  const updateMatch = /^\/api\/records\/([^/]+)$/.exec(url.pathname);
  if (req.method === 'PATCH' && updateMatch) {
    try {
      const payload = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (!statusOptions.includes(payload.status)) throw new Error('Estado invalido.');
      if (!partners.includes(payload.updatedBy)) throw new Error('Parceiro invalido.');

      const records = readRecords();
      const record = records.find(item => item.id === updateMatch[1]);
      if (!record) return json(res, 404, { error: 'Pedido nao encontrado.' });

      const timestamp = nowIso();
      record.status = payload.status;
      record.updatedBy = payload.updatedBy;
      record.updatedAt = timestamp;
      record.history.unshift({
        date: timestamp,
        partner: payload.updatedBy,
        status: payload.status,
        comment: payload.comment || 'Sem comentario adicional.'
      });
      record.notifications.unshift(`Atualizacao registada: ${payload.status}. Notificacao enviada para ${oppositePartner(payload.updatedBy)}.`);

      writeRecords(records);
      return json(res, 200, record);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  return json(res, 404, { error: 'Endpoint nao encontrado.' });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/files/')) {
    attachmentFile(req, res);
    return;
  }

  if (req.url.startsWith('/api/')) {
    handleApi(req, res).catch(error => json(res, 500, { error: error.message }));
    return;
  }
  publicFile(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`App ENDESA / INMARK ativa em http://127.0.0.1:${PORT}`);
  console.log(`Para acesso na rede, usar http://IP-DO-COMPUTADOR:${PORT}`);
});






