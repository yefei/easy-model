// create at: 2022-1-13 11:37:23 ├F10: PM┤
// create by: YeFei@DESKTOP-B7B4E7I
// database: test
// table: message

import { model } from '../../dist';

@model({
  pk: 'id',
  table: 'message',
  order: ['-id'],
})
export default class Message {
  // #region auto generate code
  // 此区域内代码请不要编辑，会在下次更新数据库结构时被覆盖
  // update at: 2022-1-13 11:43:26 ├F10: PM┤
  /**
   * int(11) auto_increment
   */
  id?: number;
  /**
   * int(11) 
   */
  user_id?: number;
  /**
   * varchar(255) 
   */
  content?: string;
  // #endregion auto generate code
}
