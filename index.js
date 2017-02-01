var MarkdownIt = require('markdown-it');
var hljs = require('highlight.js');
var server = require('http').createServer(httpHandler),
    exec = require('child_process').exec,
    io = require('socket.io').listen(server),
    os = require('os'),
    send = require('send');

var md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight: function(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(lang, str).value;
      } catch (err) {
        // Do nothing
      }
    } else {
      return str;
    }
  }
});

var opts = {
  markdown: md,
  interface: '127.0.0.1',
  allow_unsafe_content: false,
  block_external: false,
}

var lastWrittenMarkdown = '';
function writeMarkdown(body) {
  lastWrittenMarkdown = opts.md.render(body);
  io.sockets.emit('newContent', lastWrittenMarkdown);
}

function readAllInput(input, callback) {
  var body = '';
  input.on('data', function(data) {
    body += data;
    if (body.length > 1e6) {
      throw new Error('The request body is too long.');
    }
  });
  input.on('end', function() {
    callback(body);
  });
}

function addSecurityHeaders(req, res, isIndexFile) {
  var csp = [];

  // Cannot use 'self' because Chrome does not treat 'self' as http://host
  // when the sandbox directive is set.
  var HTTP_HOST = req.headers.host || 'localhost:8090';
  var CSP_SELF = 'http://' + HTTP_HOST;

  if (!opts.allow_unsafe_content) {
    if (isIndexFile) {
      // index.html will drop the scripting capabilities upon load.
      csp.push('script-src ' + CSP_SELF + " 'unsafe-inline'");
      csp.push('sandbox allow-scripts allow-modals allow-forms');
    } else {
      csp.push('script-src ');
    }
  }
  if (opts.block_external) {
    csp.push('default-src data: ' + CSP_SELF);
    csp.push("style-src data: 'unsafe-inline' " + CSP_SELF);
    csp.push('connect-src ' + CSP_SELF + ' ws://' + HTTP_HOST);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', csp.join('; '));
  if (isIndexFile) {
    // Never cache the index file, to make sure that changes to the CSP are
    // picked up across soft reloads.
    res.setHeader('Cache-Control', 'no-store');
  }
}

function httpHandler(req, res) {
  switch(req.method)
  {
    case 'GET':
      // Example: /my-repo/raw/master/sub-dir/some.png
      var githubUrl = req.url.match(/\/[^\/]+\/raw\/[^\/]+\/(.+)/);
      if (githubUrl) {
        addSecurityHeaders(req, res, false);
         // Serve the file out of the current working directory
        send(req, githubUrl[1])
         .root(process.cwd())
         .pipe(res);
        return;
      }

      var isIndexFile = /^\/(index\.html)?(\?|$)/.test(req.url);
      addSecurityHeaders(req, res, isIndexFile);

      // Otherwise serve the file from the directory this module is in
      send(req, req.url)
        .root(__dirname)
        .pipe(res);
      break;

    // case 'HEAD':
      // res.writeHead(200);
      // res.end();
      // exec('open -g http://localhost:8090', function(error, stdout, stderr){
        // http.request({port: 8090})
      // });
      // break;

    case 'DELETE':
      io.sockets.emit('die');
      process.exit();
      break;

    case 'PUT':
      readAllInput(req, writeMarkdown);
      res.writeHead(200);
      res.end();
      break;

    default:
  }
}

io.sockets.on('connection', function(sock){
  process.stdout.write('connection established!');
  if (lastWrittenMarkdown) {
    sock.emit('newContent', lastWrittenMarkdown);
  }
});


function onListening() {
  if (os.platform() === 'win32') {
    exec('start /b http://localhost:8090', function(error, stdout, stderr){});
  } else if (os.platform() === 'darwin') {
    exec('open -g http://localhost:8090', function(error, stdout, stderr){});
  } else { // assume unix/linux
    exec('xdg-open http://localhost:8090', function(error, stdout, stderr){});
  }
  readAllInput(process.stdin, function(body) {
    writeMarkdown(body);
  });
  process.stdin.resume();
}

function onServerError(e) {
  if (e.code === 'EADDRINUSE') {
    readAllInput(process.stdin, function(body) {
      // Forward to existing instant-markdown-d server.
      require('http').request({
        hostname: 'localhost',
        port: 8090,
        path: '/',
        method: 'PUT',
      }).end(body);
    });
    process.stdin.resume();
    return;
  }

  // Another unexpected error. Raise it again.
  throw e;
}

module.exports = function(newOpts) {
    for (var prop in newOpts)
       opts[prop] = newOpts[prop]
    server.listen(8090, opts.interface, onListening).once('error', onServerError);
}
