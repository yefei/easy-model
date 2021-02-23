# Easy Model

MySQL easy model, easy query. easy typing!

## install

```
npm i mysql-easy-type mysql2
```

## example

```sql
CREATE DATABASE `test`;

CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `age` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `profile` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `edu` varchar(255) DEFAULT NULL,
  `work` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `message` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `content` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk1` (`user_id`),
  CONSTRAINT `fk1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

```js
const mysql = require('mysql2');
const { model, Query } = require('mysql-easy-type');

const conn = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  database: 'test',
});

const query = new Query(conn);

const User = model('user');

// create
const id = await User(query).create({ name: 'yf', age: 11 });
console.log(id); // 1

// get and update
const user = await User(query).findByPk(id);
user.name = 'yefei';
user.save();

// find all
const users = await User(query).find().all();

// find limit
const users = await User(query).find().limit(10).all();

// find by where
const users = await User(query).find({ age: 11 }).all();

// get all count
const count = await User(query).count();

// get count by where
const count = await User(query).count({ age: 11 });
// or
const count = await User(query).find({ age: 11 }).count();

// exists
const exists = await User(query).exists({ id: 1 });
// or
const exists = await User(query).find({ age: 11 }).exists();

// update
const updatedCount = await User(query).find({ id: 1 }).update({ name: 'yf', age: 11 });

// delete
const user = await User(query).findByPk(1);
const deletedCount = await user.delete();

// transaction
query.transaction(() => {
  const user = await User(query).findByPk(1);
  await user.delete();
});

// join
const Profile = model('profile');
const Message = model('message');
const user = await Message(query).find().join(User).all();
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
/*
{
  id: 1,
  name: "yf",
  message: [
    { id: 1, content: "message content" },
    { id: 2, content: "message content" },
  ],
  profile: {
    id: 1,
    work: "work"
  }
}
*/

// many
const query = new PoolQuery(pool);
const userList = await User(query).find().many(Message, { parallel: true }).all();
```

## auto generate

edit you package.json
```json
{
  "scripts": {
    "dbgen": "mysqleasytype",
  }
}
```

create .env file:
```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=
OUTPUT_TYPES_FILE=models.d.ts
OUTPUT_MODELS_FILE=models.js
```

run:
```
npm i dotenv mysql2 --save-dev
npm run dbgen
```

## Related projects
[mysql-easy-query](https://www.npmjs.com/package/mysql-easy-query)
[sql-easy-builder](https://www.npmjs.com/package/sql-easy-builder)
