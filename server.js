const optional = require('optional');
const express = require('express');
const app = express();
const router = express.Router();
const http = require('http');
const server = http.createServer(app);

const config = require('./config/webpack.dev.config');
const webpack = optional('webpack');
const webpackDevMiddleware = optional('webpack-dev-middleware');
const webpackHotMiddleware = optional('webpack-hot-middleware');
const compiler = webpack(config);

router.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});
app.use(router);
app.use(webpackDevMiddleware(compiler, {
  publicPath: config.output.publicPath,
  stats: {colors: true}
}));
app.use(webpackHotMiddleware(compiler, {
  log: console.log
}));

var port = process.env.PORT || 8080;
server.listen(port, function() {
  console.log('listening!');
});

// game logic
var BOULDER_TIME_INIT = 3000;
var boulderTime = BOULDER_TIME_INIT;
var boulderTimer;
var io = require('socket.io')(server);
var playerIds = [];

function Boulder() {
  this.x = Math.random() * 600 / 5;
  this.velocity = Math.random() * 100 - 50;
  this.angularVelocity = Math.random() * 1000 - 500;
}

function setBoulderTimer() {
  return setInterval(function() {
    io.sockets.emit('create boulder', new Boulder());
  }, boulderTime);
}

boulderTimer = setBoulderTimer();

let diff = 0

/* logic for speeding up */
setInterval(function() {
  diff += 1
  if (diff < 8) {
    boulderTime = Math.round(boulderTime / 1.2);
    console.log('speed up!');
    clearInterval(boulderTimer);
    boulderTimer = setBoulderTimer()
  } else {
    diff = 0
    boulderTime = BOULDER_TIME_INIT
    clearInterval(boulderTimer);
    boulderTimer = setBoulderTimer()
  }
}, 5000);


io.on('connection', function(socket) {
  // new client loads other plays via ids
  socket.join(socket.id);
  playerIds.push(socket.id);
  io.sockets.in(socket.id).emit('load players', playerIds);

  console.log(playerIds);
 
  // inform clients of new player
  socket.broadcast.emit('player connect', socket.id);

  // data pushed to server gets relayed to clients
  socket.on('update server', function(data) {
    socket.broadcast.emit('update client', data);
  });
  socket.on('all dead', function() {
    boulderTime = BOULDER_TIME_INIT;
  });

  // tell other clients of a disconnect, and remove from array
  socket.on('disconnect', function() {
    socket.broadcast.emit('player disconnect', socket.id);
    playerIds.splice(playerIds.indexOf(socket.id), 1);
  });
});

