// zenorm 自动生成文件
// 请不要修改此文件，因为此文件在每次重新生成数据库结构时会被覆盖
// create at: 2022-1-14 10:41:03 ├F10: AM┤
// create by: yefei@-
// database: zenorm_test
import { Query, createRepositoryQuery } from '../../dist';
import Message from './message'
import Nonautopk from './nonautopk'
import Profile from './profile'
import User from './user'

export const MessageQuery = createRepositoryQuery(Message);
export const NonautopkQuery = createRepositoryQuery(Nonautopk);
export const ProfileQuery = createRepositoryQuery(Profile);
export const UserQuery = createRepositoryQuery(User);

export class Queries {
  _query: Query;
  constructor(query: Query) { this._query = query; }
  get message() { return MessageQuery(this._query); }
  get nonautopk() { return NonautopkQuery(this._query); }
  get profile() { return ProfileQuery(this._query); }
  get user() { return UserQuery(this._query); }
}

export {
  Message,
  Nonautopk,
  Profile,
  User,
};

declare module 'koa' {
  interface DefaultContext {
    model: Queries;
  }
}
