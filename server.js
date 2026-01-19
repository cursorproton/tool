const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.argv[2] || 8080;
const publicDir = '.';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.svg': 'application/image/svg+xml'
};

http.createServer(function(req, res) {
  console.log(`Запрошенный URL: ${req.url}`);
  
  // Обработка маршрута для сервис-воркера
  if (req.url === '/sw.js') {
    const filePath = path.join(process.cwd(), 'sw.js');
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/javascript';
    
    fs.readFile(filePath, function(error, content) {
      if (error) {
        if(error.code === 'ENOENT') {
          res.writeHead(404);
          res.end('404 Not Found');
        } else {
          res.writeHead(500);
          res.end('500 Internal Server Error');
        }
      } else {
        res.writeHead(200, {'Content-Type': contentType});
        res.end(content, 'utf-8');
      }
    });
    return;
  }
  
  // Определение пути к файлу
  var filePath = req.url === '/' ? `${publicDir}/index.html` : `${publicDir}${req.url}`;
  
  // Добавление .html к путям без расширения
  if (!path.extname(filePath)) {
    filePath += '.html';
  }
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, function(error, content) {
    if (error) {
      if(error.code === 'ENOENT') {
        // Попробовать найти файл offline.html
        fs.readFile(`${publicDir}/offline.html`, function(err, offlineContent) {
          if(err) {
            res.writeHead(404);
            res.end('404 Not Found');
          } else {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(offlineContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, {'Content-Type': contentType});
      res.end(content, 'utf-8');
    }
  });
}).listen(port);

console.log(`Сервер запущен на порту ${port}`);