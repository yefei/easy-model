'use strict';

require('dotenv').config();
const assert = require('assert');
const mysql = require('mysql');
const { Query, model } = require('..');

/*
CREATE DATABASE `test`;
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `age` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
INSERT INTO `user`(`name`, `age`) VALUES ('yefei', 30);
*/

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  user: process.env.MYSQL_USER || 'root',
  database: process.env.MYSQL_DATABASE || 'test',
  password: process.env.MYSQL_PASSWORD,
});

let conn;

before(function() {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) return reject(err);
      conn = connection;
      resolve();
    });
  });
});

after(function() {
  return new Promise((resolve, reject) => {
    pool.end(err => {
      if (err) return reject(err);
      resolve();
    });
  });
});

function eq(a, b) {
  assert.deepStrictEqual(a, b);
}

describe('Model', function() {
  const User = model('user');
  const Profile = model('profile');
  let id;

  it('create', async function() {
    const query = new Query(conn);
    id = await User(query).create({ name: 'yf', age: 11 });
    assert.ok(typeof id === 'number');
  });

  it('findByPk', async function() {
    const query = new Query(conn);
    const ins = await User(query).findByPk(id);
    eq({ id: ins.id, name: ins.name, age: ins.age }, { id, name: 'yf', age: 11 });
  });

  it('find', async function() {
    const query = new Query(conn);
    const ins = await User(query).find().all();
    assert.ok(ins.length);
  });

  it('count', async function() {
    const query = new Query(conn);
    const ins = await User(query).count();
    assert.ok(typeof ins === 'number');
  });

  it('exists', async function() {
    const query = new Query(conn);
    eq(await User(query).exists({ id }), true);
    eq(await User(query).exists({ id: -1 }), false);
  });

  it('update', async function() {
    const query = new Query(conn);
    const ins = await User(query).find({ id }).update({ name: 'yefei', age: 11 });
    eq(ins, 1);
    eq((await User(query).findByPk(id)).name, 'yefei');
  });

  it('delete', async function() {
    const query = new Query(conn);
    const ins = await User(query).find({ id }).delete();
    eq(ins, 1);
  });

  it('instance.delete', async function() {
    const query = new Query(conn);
    const id = await User(query).create({ name: 'instance.delete', age: 11 });
    const user = await User(query).findByPk(id);
    const c = await user.delete();
    eq(c, 1);
  });

  it('options.order', async function() {
    const query = new Query(conn);
    const UserWithOrder = model('user', {
      order: ['-id'],
    });
    const users = await UserWithOrder(query).find().all();
  });

  it('join', async function() {
    const query = new Query(conn);
    const users = await User(query).find().join(Profile).all();
  });
});
