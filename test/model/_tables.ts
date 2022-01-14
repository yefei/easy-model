// zenorm 自动生成文件
// 请不要修改此文件，因为此文件在每次重新生成数据库结构时会被覆盖
// create at: 2022-1-14 10:41:03 ├F10: AM┤
// create by: yefei@-
// database: zenorm_test
export class MessageTable {
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
}

export class NonautopkTable {
  /**
   * int(11) 
   */
  id?: number;
  /**
   * varchar(255) 
   */
  name?: string;
}

export class ProfileTable {
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
  edu?: string;
  /**
   * varchar(255) 
   */
  work?: string;
}

export class UserTable {
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
}
