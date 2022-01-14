// zenorm 自动生成文件
// 请不要修改此文件，因为此文件在每次重新生成数据库结构时会被覆盖
// create at: 2022-1-14 11:27:46 ├F10: AM┤
// create by: yefei@-
// database: zenorm_test
export class MessageTable {
  /**
   * type: int(11)
   * collation: null
   * null: NO
   * default: null
   * extra: auto_increment
   */
  id?: number;
  /**
   * type: int(11)
   * collation: null
   * null: NO
   * default: null
   */
  user_id: number;
  /**
   * type: varchar(255)
   * collation: utf8_general_ci
   * null: YES
   * default: null
   */
  content?: string;
}

export class NonautopkTable {
  /**
   * type: int(11)
   * collation: null
   * null: NO
   * default: null
   */
  id: number;
  /**
   * type: varchar(255)
   * collation: utf8_general_ci
   * null: YES
   * default: null
   */
  name?: string;
}

export class ProfileTable {
  /**
   * type: int(11)
   * collation: null
   * null: NO
   * default: null
   * extra: auto_increment
   */
  id?: number;
  /**
   * type: int(11)
   * collation: null
   * null: NO
   * default: null
   */
  user_id: number;
  /**
   * type: varchar(255)
   * collation: utf8_general_ci
   * null: YES
   * default: null
   */
  edu?: string;
  /**
   * type: varchar(255)
   * collation: utf8_general_ci
   * null: YES
   * default: null
   */
  work?: string;
}

export class UserTable {
  /**
   * type: int(11)
   * collation: null
   * null: NO
   * default: null
   * extra: auto_increment
   */
  id?: number;
  /**
   * type: varchar(255)
   * collation: utf8_general_ci
   * null: NO
   * default: null
   */
  name: string;
  /**
   * type: date
   * collation: null
   * null: YES
   * default: null
   */
  birthday?: Date;
}
