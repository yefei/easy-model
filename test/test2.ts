import * as mysql from 'mysql2';
import { PoolQuery } from 'mysql-easy-query';
import { model, join, many } from "../src/model";
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
  birthday: Date;

  @join(Profile)
  profile: Profile;

  @many(Message)
  messages: Message[];

  // constructor(ttt: string) {}

  get age() {
    this.profile.name;
    return this.birthday ? (new Date().getFullYear()) - this.birthday.getFullYear() : undefined;
  }

  set age(value) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - value, 1, 1);
    this.birthday = date;
  }
}

const repo = new Repository(User, query);

async function main() {
  
}

main().then(() => process.exit(0));
