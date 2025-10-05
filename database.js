const mysqldump = require('mysqldump');
const path = require('path');

const hrDB = require('knex')({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'mytaysql',
    database: 'hr'
  }
})

const stockDB = require('knex')({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'mytaysql',
    database: 'stockunion'
  }
})

module.exports = { hrDB, stockDB };