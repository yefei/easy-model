import * as mysql from 'mysql2';
import { PoolQuery } from 'mysql-easy-query';
import { Query } from '../src/types';
import { UserQuery, User, ProfileQuery, Message, MessageQuery } from './model';
import { createInstance } from '../src/instance';

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  database: 'zenorm_test',
  password: '',
});

const query = <Query> new PoolQuery(pool);

async function main() {
  /*
  console.log(User.prototype);
  console.log(Object.getOwnPropertyNames(User.prototype));
  console.log(Object.getOwnPropertyDescriptor(User.prototype, 'age'));

  // await repo.create({ name: 'test2' });

  const res = await repo.findByPk(3) || await repo.findByPk(100001);
  console.log(res);
  console.log('keys', Object.keys(res));
  console.log('values', Object.values(res));
  console.log('getOwnPropertyNames', Object.getOwnPropertyNames(res));
  console.log('JSON', JSON.stringify(res));
  console.log(res.age);
  console.log(res instanceof User);
  res.age = 66;
  // Object.assign(res, { age: 66 });
  console.log(res);
  await repo.save(res);

  res.setName('NEW');
  console.log(res);

  res.name2 = 'NEW2';
  console.log(res);
  console.log('name2', res.name2);

  // 更新主键测试
  res.id = res.id === 3 ? 100001 : 3;
  await repo.save(res);
  console.log(res);
  */

  // const joinRes = await UserQuery(query).find({ 'user.id': 1 }).join('profile').join('messages').many('messageList').get('profile.*');
  // console.log(joinRes);
  // return;

  // const profile = await ProfileQuery(query).find({ profile: { user_id: 1 } })
  //   .join(User)
  //   .join(Message, {
  //     type: 'OneToMany',
  //     fk: 'user_id',
  //     ref: 'user_id',
  //     as: 'user->messages',
  //   })
  //   .get({
  //     profile: ['id', 'user_id'],
  //     user: ['id'],
  //     'user->messages': ['id', 'content', 'user_id'],
  //   });
  // console.log(profile);

  // const messages = await MessageQuery(query).find().join(User).all();
  // console.log(messages);

  const profile = await ProfileQuery(query).find({ profile: { user_id: 1 } })
    // .join('user')
    .join('user->messages')
    .get({
      profile: ['id', 'user_id'],
      user: ['id'],
      'user->messages': ['id', 'content', 'user_id'],
    });
  console.log(profile);

  return;

  const testData = { id: 3, name: 'test2', birthday: new Date() };
  console.time('benchmark');
  for (let i = 0; i < 100000; i++) {
    createInstance(User, testData);
  }
  console.timeEnd('benchmark');
}

main().then(() => process.exit(0), e => {
  console.error(e);
  process.exit(1);
});
