import * as assert from 'assert';
import * as stringify from 'json-stable-stringify';
import { Query, AB } from 'mysql-easy-query';
import { PKVAL } from '../src';
import { PKNAME } from '../src/finder';
import { MockConnection } from './mock_mysql';
import {
  UserQuery,
  MessageQuery,
  ProfileQuery,
  User,
  Profile,
  NonautopkQuery,
  Message,
  Queries,
} from './model';

const conn = new MockConnection();
const query = new Query(conn);

function eq(a: any, b: any) {
  assert.deepStrictEqual(a, b);
}

function jsonEq(a: any, b: any) {
  eq(stringify(a), stringify(b));
}

const userData = { id: 1, name: 'yf', birthday: new Date(new Date().getFullYear() - 35, 11, 11) };
const userData2 = { id: 2, name: 'yf2', birthday: new Date(new Date().getFullYear() - 18, 5, 1) };
const profileData = { id: 2, user_id: 1, edu: 'a', work: 'b' };
const profileData2 = { id: 3, user_id: 2, edu: 'a2', work: 'b2' };

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

  conn.setMockData('SELECT `name`, `user`.`id` AS `'+PKNAME+'` FROM `user` WHERE `id` = ? LIMIT ?', [ 1, 1 ], [{ name: 'yf' }]);
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

  conn.setMockData('SELECT * FROM `user` INNER JOIN `profile` AS `p` ON (`p`.`user_id` = `user`.`id`) LIMIT ?', [1], [{
    user: userData,
    p: profileData,
  }]);
  it('join', async function() {
    const user = await UserQuery(query).find().join(Profile, {
      fk: 'id',
      ref: 'user_id',
      as: 'p',
    }).get();
    jsonEq(user, { ...user, p: profileData });
  });

  conn.setMockData('SELECT * FROM `user` LEFT JOIN `profile` ON (`profile`.`user_id` = `user`.`id`) LIMIT ?', [1], [{
    user: userData,
    profile: profileData,
  }]);
  it('join("define")', async function() {
    const user = await UserQuery(query).find().join('profile').get();
    jsonEq(user, { ...user, profile: profileData });
  });

  conn.setMockData('SELECT * FROM `user` INNER JOIN `message` ON (`message`.`user_id` = `user`.`id`) INNER JOIN `profile` ON (`profile`.`user_id` = `user`.`id`)', null, [
    { user: userData, profile: profileData, message: { id: 1, user_id: 1, content: 'u1msg1' } },
    { user: userData, profile: profileData, message: { id: 2, user_id: 1, content: 'u1msg2' } },
  ]);
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
    jsonEq(user, { ...userData, age: 35, profile: profileData, message: [
      { id: 1, user_id: 1, content: 'u1msg1' },
      { id: 2, user_id: 1, content: 'u1msg2' },
    ] })
  });

  conn.setMockData('SELECT `profile`.`id`, `profile`.`user_id`, `user`.`id`, `user->messages`.`id`, `user->messages`.`content`, `user->messages`.`user_id`, `profile`.`id` AS `'+PKNAME+'`, `user`.`id` AS `'+PKNAME+'`, `user->messages`.`id` AS `'+PKNAME+'` FROM `profile` INNER JOIN `user` ON (`user`.`id` = `profile`.`user_id`) INNER JOIN `message` AS `user->messages` ON (`user->messages`.`user_id` = `profile`.`user_id`) WHERE `profile`.`user_id` = ?', [ 1 ], [
    { profile: { id: 1, user_id: 1 }, user: { id: 1 }, 'user->messages': { id: 1, content: 'msg1', user_id: 1 } },
    { profile: { id: 1, user_id: 1 }, user: { id: 1 }, 'user->messages': { id: 2, content: 'msg2', user_id: 1 } },
  ]);
  it('join(as: path->to)', async function() {
    const profile = await ProfileQuery(query).find({ profile: { user_id: 1 } })
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
    jsonEq(profile, { id: 1, user_id: 1, user: { id: 1, messages: [
      { id: 1, content: 'msg1', user_id: 1 },
      { id: 2, content: 'msg2', user_id: 1 },
    ] } });
  });

  conn.setMockData('SELECT `profile`.`id`, `profile`.`user_id`, `user`.`id`, `user->messages`.`id`, `user->messages`.`content`, `user->messages`.`user_id`, `profile`.`id` AS `__pk`, `user`.`id` AS `__pk`, `user->messages`.`id` AS `__pk` FROM `profile` INNER JOIN `user` ON (`user`.`id` = `profile`.`user_id`) LEFT JOIN `message` AS `user->messages` ON (`user->messages`.`user_id` = `user`.`id`) WHERE `profile`.`user_id` = ?', [1], [
    { profile: { id: 1, user_id: 1, [PKNAME]: 1 }, user: { id: 1, [PKNAME]: 1 }, 'user->messages': { id: 1, content: 'msg1', user_id: 1, [PKNAME]: 1 } },
    { profile: { id: 1, user_id: 1, [PKNAME]: 1 }, user: { id: 1, [PKNAME]: 1 }, 'user->messages': { id: 2, content: 'msg2', user_id: 1, [PKNAME]: 2 } },
  ]);
  it('join("path->to")', async function() {
    const profile = await ProfileQuery(query).find({ profile: { user_id: 1 } })
    .join('user->messages')
    .get({
      profile: ['id', 'user_id'],
      user: ['id'],
      'user->messages': ['id', 'content', 'user_id'],
    });
    jsonEq(profile, { id: 1, user_id: 1, user: { id: 1, messages: [ { id: 1, content: 'msg1', user_id: 1 }, { id: 2, content: 'msg2', user_id: 1 } ] } });
  });

  conn.setMockData('SELECT * FROM `profile` INNER JOIN `user` AS `u` ON (`u`.`id` = `profile`.`user_id`) LEFT JOIN `message` AS `u->messages` ON (`u->messages`.`user_id` = `u`.`id` AND `content` LIKE ?) WHERE `profile`.`user_id` = ?', [ '%test%', 1 ], [
    { profile: profileData, u: userData, 'u->messages': { id: 1, content: 'msg1', user_id: 1 } },
    { profile: profileData, u: userData, 'u->messages': { id: 2, content: 'msg2', user_id: 1 } },
  ]);
  it('join("as->to")', async function() {
    const profile = await ProfileQuery(query).find({ profile: { user_id: 1 } })
    .join(User, { as: 'u' })
    .join('u->messages', { where: { content: { $like: '%test%' } } })
    .get();
    jsonEq(profile, { ...profileData, u: { ...userData, age: 35, messages: [ { id: 1, content: 'msg1', user_id: 1 }, { id: 2, content: 'msg2', user_id: 1 } ] } });
  });

  conn.setMockData('SELECT * FROM `user` WHERE `user`.`id` IN (?, ?)', [1,2], [userData, userData2]);
  conn.setMockData('SELECT * FROM `message` WHERE `user_id` = ? ORDER BY `id` DESC', [1], [
    { id: 1, content: 'msg1', user_id: 1 },
    { id: 2, content: 'msg2', user_id: 1 },
  ]);
  conn.setMockData('SELECT * FROM `message` WHERE `user_id` = ? ORDER BY `id` DESC', [2], [
    { id: 3, content: 'msg1', user_id: 2 },
    { id: 4, content: 'msg2', user_id: 2 },
  ]);
  it('many(Model)', async function() {
    const userList = await UserQuery(query).find({ 'user.id': [1,2] }).many(Message).all();
    jsonEq(userList, [
      { ...userData, age: 35, message: [ { id: 1, content: 'msg1', user_id: 1 }, { id: 2, content: 'msg2', user_id: 1 } ] },
      { ...userData2, age: 18, message: [ { id: 3, content: 'msg1', user_id: 2 }, { id: 4, content: 'msg2', user_id: 2 } ] },
    ]);
  });

  it('many("define")', async function() {
    const userList = await UserQuery(query).find({ 'user.id': [1,2] }).many('messageList', { parallel: true }).all();
    jsonEq(userList, [
      { ...userData, age: 35, messageList: [ { id: 1, content: 'msg1', user_id: 1 }, { id: 2, content: 'msg2', user_id: 1 } ] },
      { ...userData2, age: 18, messageList: [ { id: 3, content: 'msg1', user_id: 2 }, { id: 4, content: 'msg2', user_id: 2 } ] },
    ]);
  });

  conn.setMockData('SELECT `name`, `user`.`id` AS `'+PKNAME+'` FROM `user` LIMIT ?', [ 1 ], {
    name: 'testname', [PKNAME]: 3
  });
  it('select(...columns)', async function() {
    const user = await UserQuery(query).find().get('name');
    jsonEq(user, { name: 'testname' });
    eq(user[PKVAL], 3);
  });

  conn.setMockData('UPDATE `user` SET `name` = ? WHERE `id` = ?', [ 'newname', 3 ], { affectedRows: 1 })
  it('repo.save(ins)', async function() {
    const user = await UserQuery(query).find().get('name');
    user.name = "newname";
    const rows = await UserQuery(query).save(user);
    eq(rows, 1);
  });

  it('repo.update(coloums)', async function() {
    const repo = UserQuery(query);
    const user = await repo.find().get('name');
    const rows = await repo.update(user, { name: 'newname' });
    eq(rows, 1);
    jsonEq(user, { name: 'newname' });
  });

  conn.setMockData('DELETE FROM `user` WHERE `id` = ?', [ 1 ], { affectedRows: 1 });
  it('finder.delete()', async function() {
    const ins = await UserQuery(query).find({ id: 1 }).delete();
    eq(ins, 1);
  });

  it('repo.delete()', async function() {
    const repo = UserQuery(query);
    const user = await UserQuery(query).findByPk(1);
    const c = await repo.delete(user);
    eq(c, 1);
  });

  conn.setMockData('SELECT * FROM `user` WHERE `id` = ? OR ( `id` = ? ) LIMIT ?', [ 1, 2, 1 ], { id: 1 })
  it('finder.clone()', async function() {
    const userFinder = UserQuery(query).find({ id: 1 });
    const f2 = userFinder.clone().whereOr({ id: 2 });
    jsonEq(await f2.get(), { id: 1 });
    jsonEq(await userFinder.get(), { ...userData, age: 35 });
  });

  it('repo.createAndGet', async function() {
    const ins = await UserQuery(query).createAndGet({ name: 'yf', age: 11 });
    jsonEq(ins, { ...userData, age: 35 });
  });

  conn.setMockData('SELECT `name` AS `value` FROM `user` WHERE `id` = ? LIMIT ?', [ 1, 1 ], { value: 'yf' });
  it('value', async function() {
    const name = await UserQuery(query).find({ id: 1 }).value('name', null);
    eq(name, 'yf');
  });

  conn.setMockData('SELECT `user`.`name` AS `value` FROM `message` INNER JOIN `user` ON (`user`.`id` = `message`.`user_id`) WHERE `user`.`id` = ? ORDER BY `message`.`id` DESC LIMIT ?', [ 1, 1 ], { value: 'yfvalue2' });
  it('value.join', async function() {
    const name = await MessageQuery(query).find({ 'user.id': 1 }).join(User).value('user.name');
    eq(name, 'yfvalue2');
  });

  conn.setMockData('SELECT 1 FROM `message` INNER JOIN `user` ON (`user`.`id` = `message`.`user_id`) WHERE `user`.`id` = ? LIMIT ?', [ 1, 1 ], { 1: 1 });
  it('join.exists', async function() {
    const exists = await MessageQuery(query).find({ 'user.id': 1 }).join(User).exists();
    eq(exists, true);
  });

  conn.setMockData('SELECT * FROM `message` INNER JOIN `user` ON (`user`.`id` > ?) WHERE `user`.`id` = ? ORDER BY `message`.`id` DESC LIMIT ?', [ 0, 1, 1 ], {
    message: { id: 1, content: 'msg1' }, user: userData
  });
  it('join.where', async function() {
    const m = await MessageQuery(query).find({ 'user.id': 1 }).join(User, { where: { 'user.id': { $gt: 0 } } }).get();
    jsonEq(m, { id: 1, content: 'msg1', user: { ...userData, age: 35 } });
  });

  conn.setMockData('SELECT `user`.*, COUNT(`message`.`id`) AS `messageCount`, `user`.`id` AS `__pk`, `message`.`id` AS `__pk` FROM `user` INNER JOIN `message` ON (`message`.`user_id` = `user`.`id`) GROUP BY `user`.`id` HAVING `messageCount` > ?', [ 2 ], [
    { user: { ...userData, __pk: 1 }, '': { messageCount: 3 }, message: { __pk: 1 } },
  ]);
  it('group', async function() {
    const m = await UserQuery(query).find().join(Message, {
      fk: 'id',
      ref: 'user_id',
    })
    .group('user.id')
    .having({ messageCount: { $gt: 2 } })
    .all({ user: ['*'], messageCount: AB.count('message.id') });
    jsonEq(m, [{ ...userData, age: 35, messageCount: 3, message: {} }]);
  });

  conn.setMockData('SELECT * FROM `message` LEFT JOIN `user` ON (`user`.`id` = `message`.`user_id` AND `user`.`name` = ?) INNER JOIN `profile` AS `user->profile` ON (`user->profile`.`user_id` = `message`.`user_id`) WHERE `message`.`id` = ? ORDER BY `message`.`id` DESC LIMIT ?', [ 'notexists', 1, 1 ], {
    message: { id: 1, content: 'msg1' }, 'user->profile': profileData, user: { id: null, name: null, birthday: null }
  });
  it('left left of null', async function() {
    const data = await MessageQuery(query)
      .find({ message: { id:  1 } })
      .join(User, { where: { 'user.name': 'notexists' }, optional: true })
      .join(Profile, { as: 'user->profile', ref: 'user_id', fk: 'user_id' })
      .get();
    jsonEq(data, { id: 1, content: 'msg1' });
  });

  conn.setMockData('SELECT COUNT(*) AS `c` FROM `message`', null, { c: 100 });
  conn.setMockData('SELECT * FROM `message` ORDER BY `id` DESC LIMIT ? OFFSET ?', [ 10, 0 ], [
    { id: 3, content: 'msg3' },
    { id: 2, content: 'msg2' },
    { id: 1, content: 'msg1' },
  ]);
  it('page', async function() {
    const data = await MessageQuery(query).find().page({ limit: 10, order: ['-id'] });
    jsonEq(data, { limit: 10, offset: 0, order: [ '-id' ], total: 100, list: [
      { id: 3, content: 'msg3'}, { id: 2, content: 'msg2'}, { id: 1, content: 'msg1'}
    ] });
  });

  it('Model@data set', async function() {
    const repo = UserQuery(query);
    const user = await repo.findByPk(1);
    user.age = 100;
    conn.setMockData('UPDATE `user` SET `birthday` = ? WHERE `id` = ?', [ user.birthday, 1 ], { affectedRows: 1 });
    const num = await repo.save(user);
    eq(num, 1);
  });

  conn.setMockData('SELECT COUNT(*) AS `c` FROM `profile`', null, { c: 200 });
  conn.setMockData('SELECT COUNT(*) AS `c` FROM `nonautopk`', null, { c: 300 });
  it('Queries', async function() {
    const qs = new Queries(query);
    const c1 = await qs.user.count();
    eq(c1, 1);
    const c2 = await qs.message.count();
    eq(c2, 100);
    const c3 = await qs.profile.count();
    eq(c3, 200);
    const c4 = await qs.nonautopk.count();
    eq(c4, 300);
  });

  conn.setMockData('SELECT * FROM `nonautopk` WHERE `id` = ? LIMIT ?', [ 1, 1 ], {  });
  it('assertPk', async function() {
    const r = await NonautopkQuery(query).findByPk(1);
    try {
      await NonautopkQuery(query).save(r);
      assert.ok(false, 'error');
    } catch (e) {
      eq(e.message, 'Missing primary key value.');
    }
  });

});
