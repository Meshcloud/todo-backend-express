var app = require('express')(),
    bodyParser = require('body-parser'),
    backend = require('./backend'),
    DBMigrate = require('db-migrate');

var vcap_services = JSON.parse(process.env.VCAP_SERVICES);
var cfservice = (vcap_services && vcap_services.PostgreSQL && vcap_services.PostgreSQL.length && vcap_services.PostgreSQL[0].credentials.url);
var CONNECTION_STRING = cfservice || process.env.DATABASE_URL;
// ----- Parse JSON requests

app.use(bodyParser.json());

// ----- Allow CORS

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE');
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// ----- The API implementation

var todos = backend(CONNECTION_STRING);

function createCallback(res, onSuccess) {
  return function callback(err, data) {
    if (err || !data) {
      res.status(500).send('Something bad happened!');
      console.error(err);
      return;
    }

    onSuccess(data);
  }
}

function createTodo(req, data) {
  return {
    title: data.title,
    order: data.order,
    completed: data.completed || false,
    url: req.protocol + '://' + req.get('host') + '/' + data.id
  };
}

function getCreateTodo(req) {
  return function(data) {
    return createTodo(req, data);
  };
}

app.get('/', function(req, res) {
  todos.all(createCallback(res, function(todos) {
    res.send(todos.map(getCreateTodo(req)));
  }));
});

app.get('/:id', function(req, res) {
  todos.get(req.params.id, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

app.post('/', function(req, res) {
  todos.create(req.body.title, req.body.order, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

app.patch('/:id', function(req, res) {
  todos.update(req.params.id, req.body, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

app.delete('/', function(req, res) {
  todos.clear(createCallback(res, function(todos) {
    res.send(todos.map(getCreateTodo(req)));
  }));
});

app.delete('/:id', function(req, res) {
  todos.delete(req.params.id, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

var dbmigrate = DBMigrate.getInstance(true, {defaultEnv: 'prod', prod: CONNECTION_STRING});
dbmigrate.up().then(() => app.listen(Number(process.env.PORT || 5000)));
