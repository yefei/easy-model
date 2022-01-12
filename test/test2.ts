import * as mysql from 'mysql2';
import { PoolQuery } from 'mysql-easy-query';
import { model, join, many, virtual } from "../src/model";
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
  name: string;

  birthday: Date;

  @join(Profile)
  profile: Profile;

  @many(Message)
  messages: Message[];

  @virtual({
    get() {
      return this.birthday ? (new Date().getFullYear()) - this.birthday.getFullYear() : undefined;
    },
    set(v) {
      const date = new Date();
      date.setFullYear(date.getFullYear() - v, 1, 1);
      this.birthday = date;
    }
  })
  age: number;
}

const repo = new Repository(User, query);

async function main() {
  console.log(User.prototype);
  const res = await repo.findByPk(3);
  console.log(res);
  console.log(JSON.stringify(res));
  console.log(Object.getOwnPropertyNames(res));
  console.log(res.age);
  console.log(res instanceof User);
  res.age = 66;
  await repo.save(res);
}

main().then(() => process.exit(0), e => {
  console.error(e);
  process.exit(1);
});
