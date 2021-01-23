# Easy Model

MySQL easy model, easy query. easy typing!

## install

```
npm i @feiye/easy-model
```

## example

```js
const mysql = require('mysql');
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

```

## Related projects
[mysql-easy-query](https://www.npmjs.com/package/mysql-easy-query)
[sql-easy-builder](https://www.npmjs.com/package/sql-easy-builder)
