# ZenORM

Easy ORM, easy query. easy typing! Auto generate typescript declaration.

## install

```
npm i zenorm mysql-easy-query
```

## example

```sql
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `profile` (
  `id` int(11) NOT NULL,
  `edu` varchar(255) DEFAULT NULL,
  `work` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `message` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `content` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk1` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

```ts
import * as mysql from 'mysql2';
import { model, join, many, data, createRepositoryQuery } from 'zenorm';
import { Query } from 'mysql-easy-query';

class User {
  @join(Profile, { type: 'OneToOne' })
  profile?: Profile;

  @join(Message)
  messages?: Message[];

  @many(Message)
  messageList?: Message[];

  @data
  get age() {
    return this.birthday ? (new Date().getFullYear()) - this.birthday.getFullYear() : undefined;
  }

  set age(v) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - v, 1, 1);
    this.birthday = date;
  }
}

class Profile {
  @join(User)
  user?: User;
}

@model({
  pk: 'id',
  table: 'message',
  order: ['-id'],
})
class Message {
}

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  database: 'test',
  password: '',
});

const query = <Query> new PoolQuery(pool);

const UserQuery = createRepositoryQuery(User);
const MessageQuery = createRepositoryQuery(Message);

const userRepo = UserQuery(query);

// create
const id = await userRepo.create({ name: 'yf' });
console.log(id); // 1

// get and update
const user = await userRepo.findByPk(id);
user.name = 'yefei';
user.age = 20;
await userRepo.save(user);

// find all
const users = await userRepo.find().all();

// find limit
const users = await userRepo.find().limit(10).all();

// find by where
const users = await userRepo.find({ name: { $like: `%y%` } }).all();

// get all count
const count = await userRepo.count();

// page
const page = await userRepo.page();

// exists
const exists = await userRepo.exists({ id: 1 });
// or
const exists = await userRepo.find({ name: 'yf' }).exists();

// update
const updatedCount = await userRepo.find({ id: 1 }).update({ name: 'yf', age: 11 });

// delete
const user = await userRepo.findByPk(1);
const deletedCount = await userRepo.delete(user);

await userRepo.find({ name: 'aaa' }).delete();

// transaction
await query.transaction(async tx => {
  await UserQuery(tx).find().update({ some: 'data' });
  await MessageQuery(tx).find().update({ some: 'data' });
});

// join
const user = await MessageQuery(query).find().join(User).all();
/*
[
  {
    id: 1,
    content: "message content",
    user: {
      id: 1,
      name: "yf"
    }
  }
]
*/

// join 2
const user = await userRepo.find().join("messages").get();
/*
{
  id: 1,
  name: "yf",
  messages: [
    { id: 1, content: "message content" },
    { id: 2, content: "message content" },
  ]
}
*/

// many
const userList = await userRepo.find().many("messageList").all();
```

## auto generate

edit you package.json
```json
{
  "scripts": {
    "dbgen": "zenorm gen config.json",
  }
}
```

create config.json file:
```json
{
  "database": "test",
  "host": "localhost",
  "port": 3306,
  "user": "root",
  "password": "",
}
```

run:
```
npm run dbgen
```

## Related projects
[mysql-easy-query](https://www.npmjs.com/package/mysql-easy-query)
[sql-easy-builder](https://www.npmjs.com/package/sql-easy-builder)
