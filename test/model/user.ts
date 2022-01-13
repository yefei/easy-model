// create at: 2022-1-13 11:37:23 ├F10: PM┤
// create by: YeFei@DESKTOP-B7B4E7I
// database: test
// table: user

import { data, join, many, model } from '../../dist';
import Message from './message';
import Profile from './profile';

@model({
  pk: 'id',
  table: 'user',
})
export default class User {
  // #region auto generate code
  // 此区域内代码请不要编辑，会在下次更新数据库结构时被覆盖
  // update at: 2022-1-13 11:43:26 ├F10: PM┤
  /**
   * int(11) auto_increment
   */
  id?: number;
  /**
   * varchar(255) 
   */
  name?: string;
  /**
   * date 
   */
  birthday?: Date;
  /**
   * timestamp 
   */
  created_at?: Date;
  /**
   * timestamp 
   */
  updated_at?: Date;
  // #endregion auto generate code

  @join(Profile)
  profile: Profile;

  @join(Message)
  messages: Message[];

  @many(Message)
  messageList: Message[];

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
