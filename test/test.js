'use strict';

const assert = require('assert');
const mysql = require('mysql2');
const { Query, PoolQuery, AB } = require('mysql-easy-query');
const { model } = require('zenorm');
const {
  UserQuery: User,
  MessageQuery: Message,
  ProfileQuery: Profile,
} = require('./_dist/models.js');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  user: process.env.MYSQL_USER || 'root',
  database: process.env.MYSQL_DATABASE || 'zenorm_test',
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
  let id, profileId;

  it('create', async function() {
    const query = new Query(conn);
    id = await User(query).create({ name: 'yf', age: 11 });
    assert.ok(typeof id === 'number');
    profileId = await Profile(query).create({ user_id: id, edu: 'edu', work: 'work' });
    for(let i = 0; i < 10; i++) {
      await Message(query).create({ user_id: id, content: `message:${i}` });
    }
  });

  it('findByPk', async function() {
    const query = new Query(conn);
    const ins = await User(query).findByPk(id);
    eq({ id: ins.id, name: ins.name, age: ins.age }, { id, name: 'yf', age: 11 });
  });

  it('findByPk(...columns)', async function() {
    const query = new Query(conn);
    const ins = await User(query).findByPk(id, 'name');
    eq(JSON.stringify(ins), '{"name":"yf"}');
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

  it('finder.count()', async function() {
    const query = new Query(conn);
    const ins = await User(query).find().count();
    assert.ok(typeof ins === 'number');
  });

  it('finder.count(AB)', async function() {
    const query = new Query(conn);
    let ins = await User(query).find().count('id');
    assert.ok(typeof ins === 'number');
    ins = await User(query).find().count(AB.SQL`DISTINCT {id}`);
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

  it('options.order', async function() {
    const query = new Query(conn);
    const UserWithOrder = model('user', {
      order: ['-id'],
    });
    const users = await UserWithOrder(query).find().all();
  });

  it('join', async function() {
    const query = new Query(conn);
    const user = await User(query).find().join(Profile, {
      fk: 'id',
      ref: 'user_id',
      as: 'p',
    }).get();
    assert.ok(typeof user.save === 'function');
    assert.ok(typeof user.p.save === 'function');
  });

  it('join("define")', async function() {
    const query = new Query(conn);
    const user = await User(query).find().join('profile').get();
    assert.ok(typeof user.save === 'function');
    assert.ok(typeof user.profile.save === 'function');
  });

  it('join(Finder)', async function() {
    const query = new Query(conn);
    const user = await User(query).find().join(Profile(query), {
      fk: 'id',
      ref: 'user_id',
      as: 'p',
    }).get();
    assert.ok(typeof user.save === 'function');
    assert.ok(typeof user.p.save === 'function');
  });

  it('join(toList)', async function() {
    const query = new Query(conn);
    const user = await User(query).find().join(Message, {
      fk: 'id',
      ref: 'user_id',
      asList: true,
    })
    .join(Profile, {
      fk: 'id',
      ref: 'user_id',
    })
    .get();
    assert.ok(typeof user.save === 'function');
    assert.ok(Array.isArray(user.message));
    assert.ok(typeof user.profile.save === 'function');
  });

  it('join(as: path->to)', async function() {
    const query = new Query(conn);
    const profile = await Profile(query).find({ profile: { user_id: id } })
    .join(User)
    .join(Message, {
      fk: 'user_id',
      ref: 'user_id',
      as: 'user->messages',
      asList: true,
    })
    .get({
      profile: ['id', 'user_id'],
      user: ['id'],
      'user->messages': ['id', 'content', 'user_id'],
    });
    assert.ok(profile.user_id === id);
    assert.ok(profile.user.id === id);
    for (const m of profile.user.messages) {
      assert.ok(m.user_id === id);
    }
    const m = profile.user.messages.pop();
    m.content = 'join(as).test';
    await m.save();
  });

  it('join("path->to")', async function() {
    const query = new Query(conn);
    const profile = await Profile(query).find({ profile: { user_id: id } })
    .join('user')
    .join('user->messages')
    .get({
      profile: ['id', 'user_id'],
      user: ['id'],
      'user->messages': ['id', 'content', 'user_id'],
    });
    assert.ok(profile.user_id === id);
    assert.ok(profile.user.id === id);
    for (const m of profile.user.messages) {
      assert.ok(m.user_id === id);
    }
  });

  it('join("as->to")', async function() {
    const query = new Query(conn);
    const profile = await Profile(query).find({ profile: { user_id: id } })
    .join(User, { as: 'u' })
    .join('u->messages', { where: { content: { $like: '%test%' } } })
    .get({
      profile: ['id', 'user_id'],
      u: ['id'],
      'u->messages': ['id', 'content', 'user_id'],
    });
    assert.ok(profile.user_id === id);
    assert.ok(profile.u.id === id);
    for (const m of profile.u.messages) {
      assert.ok(m.user_id === id);
    }
  });

  it('many(parallel)', async function() {
    const query = new PoolQuery(pool);
    const userList = await User(query).find().many(Message, { parallel: true }).all();
    for (const user of userList) {
      for (const m of user.message) {
        assert.ok(m.user_id === user.id);
      }
    }
  });

  it('many("define")', async function() {
    const query = new PoolQuery(pool);
    const userList = await User(query).find().many('messageList', { parallel: true }).all();
    for (const user of userList) {
      for (const m of user.messageList) {
        assert.ok(m.user_id === user.id);
      }
    }
  });

  it('select(...columns)', async function() {
    const query = new Query(conn);
    const user = await User(query).find().get('name');
    assert.ok(typeof user.save === 'function');
    try {
      user.name = "666";
      await user.save();
      assert(false, "error");
    } catch (e) {}
  });

  it('save()', async function() {
    const query = new Query(conn);
    const user = await User(query).find().get('name', 'id');
    user.name = "222";
    await user.save();
  });

  it('update(coloums)', async function() {
    const query = new Query(conn);
    const user = await User(query).find().get('name', 'id');
    await user.update({ name: '123456' });
    assert(user.name, "123456");
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

  it('finder.clone', async function() {
    const query = new Query(conn);
    const userFinder = User(query).find({ id: 1 });
    userFinder.clone().whereAnd({ id: 2 });
    await userFinder.get();
  });

  it('finder.whereAnd', async function() {
    const query = new Query(conn);
    const userFinder = User(query).find();
    userFinder.whereAnd({ id: 2 }).whereOr({ name: 111 });
    await userFinder.get();
  });

  it('createAndGet', async function() {
    const query = new Query(conn);
    const ins = await User(query).createAndGet({ name: 'yf', age: 11 });
    eq({ name: ins.name, age: ins.age }, { name: 'yf', age: 11 });
  });

  it('value', async function() {
    const query = new Query(conn);
    const id = await User(query).create({ name: 'yfvalue' });
    const name = await User(query).find({ id }).value('name', null);
    eq(name, 'yfvalue');
  });

  it('value.join', async function() {
    const query = new Query(conn);
    const id = await User(query).create({ name: 'yfvalue2' });
    await Message(query).create({ user_id: id, content: 'test' });
    const name = await Message(query).find({ 'user.id': id }).join(User).value('user.name');
    eq(name, 'yfvalue2');
  });

  it('join.exists', async function() {
    const query = new Query(conn);
    const id = await User(query).create({ name: 'join.exists' });
    await Message(query).create({ user_id: id, content: 'test' });
    const exists = await Message(query).find({ 'user.id': id }).join(User).exists();
    eq(exists, true);
  });

  it('join.where', async function() {
    const query = new Query(conn);
    const id = await User(query).create({ name: 'join.where' });
    await Message(query).create({ user_id: id, content: 'test' });
    const m = await Message(query).find({ 'user.id': id }).join(User, { where: { 'user.id': { $gt: 0 } } }).get();
    eq(m.user.id, id);
  });

  it('join.get empty list', async function() {
    const query = new Query(conn);
    const m = await Message(query).find({ 'user.id': 1 }).join(User, { where: { 'user.id': 99999 } }).get();
    eq(m, null);
  });

  it('group', async function() {
    const query = new Query(conn);
    const m = await User(query).find().join(Message, {
      fk: 'id',
      ref: 'user_id',
    })
    .group('user.id')
    .having({ messageCount: { $gt: 2 } })
    .all({ user: ['*'], messageCount: AB.count('message.id') });
    for (const i of m) {
      eq(typeof i.messageCount, 'number');
      eq(typeof i.id, 'number');
    }
  });

  it('group(AB)', async function() {
    const query = new Query(conn);
    const m = await Message(query).find()
    .group('user_id')
    .all('user_id', { messageCount: AB.count('user_id') });
    for (const i of m) {
      eq(typeof i.messageCount, 'number');
      eq(typeof i.user_id, 'number');
    }
  });

  it('NonAutoPk', async function() {
    const query = new Query(conn);
    const NonAutoPk = model('nonautopk');
    const maxId = await NonAutoPk(query).find().value(AB.max('id'), 0);
    eq(typeof maxId, 'number');
    const ins = await NonAutoPk(query).create({ id: maxId + 1, name: 'test' });
    eq(maxId + 1, ins);
  });

  it('left left of null', async function() {
    const query = new Query(conn);
    const data = await Message(query)
      .find({ message: { id:  1 } })
      .join(User, { type: 'LEFT', where: { name: 'not exists' } })
      .join(Profile, { from: 'user', type: 'LEFT', as: 'user->profile', ref: 'user_id', fk: 'id' })
      .get();
    eq(typeof data.user, 'undefined');
  });

  it('left left of not null', async function() {
    const query = new Query(conn);
    const data = await Message(query)
      .find({ message: { id:  1 } })
      .join(User, { type: 'LEFT', where: { name: 'not exists' } })
      .join(Profile, { type: 'LEFT', as: 'user->profile', ref: 'user_id', fk: 'id' })
      .get();
    eq(typeof data.user.profile, 'object');
  });

  it('page', async function() {
    const query = new Query(conn);
    const data = await Message(query).find().page({ limit: 10, order: ['-id'] });
    assert.ok(data.total > 0);
    assert.ok(data.list.length > 0);

    const data2 = await Message(query).find().page({ limit: 10, order: '-id' });
    assert.ok(data2.total == data.total);
    assert.ok(data2.list.length == data.list.length);
  });

  it('join.get(id, user.name)', async function() {
    const query = new Query(conn);
    const data = await Message(query).find()
      .join(User).get('id', 'content', 'user.name');
    eq(typeof data.id, 'number');
    eq(typeof data.user.name, 'string');
  });

  it('join.order(X)', async function() {
    const query = new Query(conn);
    const data = await Message(query).find()
      .join(User).group('user.id').order('-x').get('id', 'content', 'user.name', 'user.id', AB.SQL`COUNT({user.id}) AS {x}`);
  });

  it('default order', async function() {
    const query = new Query(conn);
    await Message(query).find().all();
    await Message(query).find().join(User).all();
  });
});
