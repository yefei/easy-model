import * as mysql from 'mysql2';
import { PoolQuery } from 'mysql-easy-query';
import { model, join, many, data, Model } from "../src/model";
import { Repository } from "../src/repository";
import { Query } from '../src/types';

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  database: 'zenorm_test',
  password: '',
});

const query = <Query> new PoolQuery(pool);

class Profile {
  name: string;
}

class Message {}

@model()
class User {
  id: number;

  name: string;

  birthday: Date;

  @join(Profile)
  profile: Profile;

  @many(Message)
  messages: Message[];

  desc: string = "123456";

  // constructor(data: DataResult) {
  //   console.log('user init', data);
  // }

  // constructor() {}

  @data
  get age() {
    return this.birthday ? (new Date().getFullYear()) - this.birthday.getFullYear() : undefined;
  }

  set age(v) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - v, 1, 1);
    this.birthday = date;
  }

  setName(newName: string) {
    this.name = newName;
  }

  get name2() {
    return '没用的name2';
  }

  /**
   * 下面是错误的使用方法
   * 因为 set 中的 this 已经被拦截到原始对象中，再去使用 this.name 修改值无法再次被拦截处理，否则会出现死循环
   */
  set name2(newName: string) {
    this.name = newName;
  }
}

const repo = new Repository(User, query);

async function main() {
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

  return;

  const testData = { id: 3, name: 'test2', birthday: new Date() };
  console.time('benchmark');
  for (let i = 0; i < 100000; i++) {
    repo.createInstance(testData);
  }
  console.timeEnd('benchmark');
}

main().then(() => process.exit(0), e => {
  console.error(e);
  process.exit(1);
});
