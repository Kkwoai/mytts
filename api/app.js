const express = require('express');
const logger = require('morgan');
const bodyParser = require("body-parser");
const api = require('./routes/api');

const app = express();

const http = require('http');
const server = http.createServer(app);

app.use(logger('dev'));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(express.urlencoded({ extended: false }));
// app.use(express.static(__dirname+'/html'))
app.use('/api', api);

app.get('/', function (req, res){
  res.sendFile(__dirname + '/index.html')
})

server.listen('3000')
