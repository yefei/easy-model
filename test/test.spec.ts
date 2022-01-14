import * as assert from 'assert';
import { Query, AB } from 'mysql-easy-query';
import { MockConnection } from './mock_mysql';
import {
  UserQuery,
  MessageQuery,
  ProfileQuery,
  User,
  Profile,
  NonautopkQuery,
  Message,
} from './model';

const conn = new MockConnection();
const query = new Query(conn);

function eq(a: any, b: any) {
  assert.deepStrictEqual(a, b);
}

function jsonEq(a: any, b: any) {
  eq(JSON.stringify(a), JSON.stringify(b));
}

const userData = { id: 1, name: 'yf', birthday: new Date(new Date().getFullYear() - 35, 11, 11) };
const profileData = { id: 2, user_id: 1, edu: 'a', work: 'b' };

describe('Model', function() {

  conn.setMockData("INSERT INTO `user` ( `name`, `age` ) VALUES ( ?, ? )", [ 'yf', 11 ], { insertId: 1 });
  it('create', async function() {
    const id = await UserQuery(query).create({ name: 'yf', age: 11 });
    assert.ok(id === 1);
  });

  conn.setMockData('SELECT * FROM `user` WHERE `id` = ? LIMIT ?', [ 1, 1 ], [userData]);
  it('findByPk', async function() {
    const ins = await UserQuery(query).findByPk(1);
    jsonEq(ins, { ...userData, age: 35 });
  });

  conn.setMockData('SELECT `name` FROM `user` WHERE `id` = ? LIMIT ?', [ 1, 1 ], [{ name: 'yf' }]);
  it('findByPk(...columns)', async function() {
    const ins = await UserQuery(query).findByPk(1, 'name');
    jsonEq(ins, { name: 'yf' });
  });

  conn.setMockData('SELECT * FROM `user`', null, [userData]);
  it('all', async function() {
    const ins = await UserQuery(query).find().all();
    jsonEq(ins, [{ ...userData, age: 35 }]);
  });

  conn.setMockData('SELECT COUNT(*) AS `c` FROM `user`', null, { c: 1 });
  it('count', async function() {
    const count = await UserQuery(query).count();
    eq(count, 1);
  });

  conn.setMockData('SELECT COUNT(`id`) AS `c` FROM `user`', null, { c: 1 });
  conn.setMockData('SELECT COUNT(DISTINCT `id`) AS `c` FROM `user`', null, { c: 1 });
  it('finder.count(AB)', async function() {
    let count = await UserQuery(query).find().count('id');
    eq(count, 1);
    count = await UserQuery(query).find().count(AB.SQL`DISTINCT {id}`);
    eq(count, 1);
  });

  conn.setMockData('SELECT 1 FROM `user` WHERE `id` = ? LIMIT ?', [ 1, 1 ], { 1: 1 });
  it('exists', async function() {
    eq(await UserQuery(query).exists({ id: 1 }), true);
    eq(await UserQuery(query).exists({ id: -1 }), false);
  });

  conn.setMockData('UPDATE `user` SET `name` = ?, `age` = ? WHERE `id` = ?', [ 'yf', 11, 1 ], { affectedRows: 1 });
  it('update', async function() {
    const ins = await UserQuery(query).find({ id: 1 }).update({ name: 'yf', age: 11 });
    eq(ins, 1);
    eq((await UserQuery(query).findByPk(1)).name, 'yf');
  });

  conn.setMockData('SELECT * FROM `message` ORDER BY `id` DESC', null, [{ content: 'abc' }]);
  it('options.order', async function() {
    const res = await MessageQuery(query).find().all();
    jsonEq(res, [{ content: 'abc' }]);
  });

  conn.setMockData('SELECT * FROM `user` INNER JOIN `profile` AS `p` ON (`p`.`user_id` = `user`.`id`)', null, {
    user: userData,
    profile: profileData,
  });
  it('join', async function() {
    const user = await UserQuery(query).find().join(Profile, {
      fk: 'id',
      ref: 'user_id',
      as: 'p',
    }).get();
    console.log(user);
  });
  return;

  it('join("define")', async function() {
    const user = await UserQuery(query).find().join('profile').get();
    assert.ok(typeof user.save === 'function');
    assert.ok(typeof user.profile.save === 'function');
  });

  it('join(toList)', async function() {
    const user = await UserQuery(query).find().join(Message, {
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
    const profile = await ProfileQuery(query).find({ profile: { user_id: id } })
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
    const profile = await ProfileQuery(query).find({ profile: { user_id: id } })
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
    const profile = await ProfileQuery(query).find({ profile: { user_id: id } })
    .join(UserQuery, { as: 'u' })
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
    const userList = await UserQuery(query).find().many(Message, { parallel: true }).all();
    for (const user of userList) {
      for (const m of user.message) {
        assert.ok(m.user_id === user.id);
      }
    }
  });

  it('many("define")', async function() {
    const userList = await UserQuery(query).find().many('messageList', { parallel: true }).all();
    for (const user of userList) {
      for (const m of user.messageList) {
        assert.ok(m.user_id === user.id);
      }
    }
  });

  it('select(...columns)', async function() {
    const user = await UserQuery(query).find().get('name');
    assert.ok(typeof user.save === 'function');
    try {
      user.name = "666";
      await user.save();
      assert(false, "error");
    } catch (e) {}
  });

  it('save()', async function() {
    const user = await UserQuery(query).find().get('name', 'id');
    user.name = "222";
    await user.save();
  });

  it('update(coloums)', async function() {
    const user = await UserQuery(query).find().get('name', 'id');
    await user.update({ name: '123456' });
    assert(user.name, "123456");
  });

  it('delete', async function() {
    const ins = await UserQuery(query).find({ id }).delete();
    eq(ins, 1);
  });

  it('instance.delete', async function() {
    const id = await UserQuery(query).create({ name: 'instance.delete', age: 11 });
    const user = await UserQuery(query).findByPk(id);
    const c = await user.delete();
    eq(c, 1);
  });

  it('finder.clone', async function() {
    const userFinder = UserQuery(query).find({ id: 1 });
    userFinder.clone().whereAnd({ id: 2 });
    await userFinder.get();
  });

  it('finder.whereAnd', async function() {
    const userFinder = UserQuery(query).find();
    userFinder.whereAnd({ id: 2 }).whereOr({ name: 111 });
    await userFinder.get();
  });

  it('createAndGet', async function() {
    const ins = await UserQuery(query).createAndGet({ name: 'yf', age: 11 });
    eq({ name: ins.name, age: ins.age }, { name: 'yf', age: 11 });
  });

  it('value', async function() {
    const id = await UserQuery(query).create({ name: 'yfvalue' });
    const name = await UserQuery(query).find({ id }).value('name', null);
    eq(name, 'yfvalue');
  });

  it('value.join', async function() {
    const id = await UserQuery(query).create({ name: 'yfvalue2' });
    await MessageQuery(query).create({ user_id: id, content: 'test' });
    const name = await MessageQuery(query).find({ 'user.id': id }).join(User).value('user.name');
    eq(name, 'yfvalue2');
  });

  it('join.exists', async function() {
    const id = await UserQuery(query).create({ name: 'join.exists' });
    await MessageQuery(query).create({ user_id: id, content: 'test' });
    const exists = await MessageQuery(query).find({ 'user.id': id }).join(User).exists();
    eq(exists, true);
  });

  it('join.where', async function() {
    const id = await UserQuery(query).create({ name: 'join.where' });
    await MessageQuery(query).create({ user_id: id, content: 'test' });
    const m = await MessageQuery(query).find({ 'user.id': id }).join(User, { where: { 'user.id': { $gt: 0 } } }).get();
    eq(m.user.id, id);
  });

  it('join.get empty list', async function() {
    const m = await MessageQuery(query).find({ 'user.id': 1 }).join(User, { where: { 'user.id': 99999 } }).get();
    eq(m, null);
  });

  it('group', async function() {
    const m = await UserQuery(query).find().join(Message, {
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
    const m = await MessageQuery(query).find()
    .group('user_id')
    .all('user_id', { messageCount: AB.count('user_id') });
    for (const i of m) {
      eq(typeof i.messageCount, 'number');
      eq(typeof i.user_id, 'number');
    }
  });

  it('NonAutoPk', async function() {
    const maxId = await NonautopkQuery(query).find().value(AB.max('id'), 0);
    eq(typeof maxId, 'number');
    const ins = await NonautopkQuery(query).create({ id: maxId + 1, name: 'test' });
    eq(maxId + 1, ins);
  });

  it('left left of null', async function() {
    const data = await MessageQuery(query)
      .find({ message: { id:  1 } })
      .join(User, { type: 'LEFT', where: { name: 'not exists' } })
      .join(Profile, { from: 'user', type: 'LEFT', as: 'user->profile', ref: 'user_id', fk: 'id' })
      .get();
    eq(typeof data.user, 'undefined');
  });

  it('left left of not null', async function() {
    const data = await MessageQuery(query)
      .find({ message: { id:  1 } })
      .join(User, { type: 'LEFT', where: { name: 'not exists' } })
      .join(Profile, { type: 'LEFT', as: 'user->profile', ref: 'user_id', fk: 'id' })
      .get();
    eq(typeof data.user.profile, 'object');
  });

  it('page', async function() {
    const data = await MessageQuery(query).find().page({ limit: 10, order: ['-id'] });
    assert.ok(data.total > 0);
    assert.ok(data.list.length > 0);

    const data2 = await MessageQuery(query).find().page({ limit: 10, order: '-id' });
    assert.ok(data2.total == data.total);
    assert.ok(data2.list.length == data.list.length);
  });

  it('join.get(id, user.name)', async function() {
    const data = await MessageQuery(query).find()
      .join(User).get('id', 'content', 'user.name');
    eq(typeof data.id, 'number');
    eq(typeof data.user.name, 'string');
  });

  it('join.order(X)', async function() {
    const data = await MessageQuery(query).find()
      .join(User).group('user.id').order('-x').get('id', 'content', 'user.name', 'user.id', AB.SQL`COUNT({user.id}) AS {x}`);
  });

  it('default order', async function() {
    await MessageQuery(query).find().all();
    await MessageQuery(query).find().join(User).all();
  });
});
