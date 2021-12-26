import { Builder } from "sql-easy-builder";
import { Model, OPTION } from "./model";

/**
 * 数据库结果类型
 */
export type ColumnValue = string | number | boolean | Date;

/**
 * 结果行对象
 */
export type DataRow = { [column: string]: ColumnValue };

/**
 * Model class
 */
export interface ModelClass<T> {
  new (pkvak?: ColumnValue, data?: DataRow): T;
  [OPTION]: ModelOption;
}

/**
 * 数据库列别名
 */
export type ColumnAs = { [column: string]: string };

/**
 * 数据库列名列表
 */
export type ColumnList = (string | ColumnAs)[];

/**
 * 模型查询方法
 */
// export type ModelQuery = <T extends Model>(query: Query) => T;

/**
 * 联合查询设置
 */
export interface JoinOption {
  /** 来源, 默认取 {joinModel.name} */
  from?: string;

  /** 使用的外键，默认取 {joinModel.name}_{joinModel.pk} */
  fk?: string;

  /** 引用键，默认取 {model.pk} */
  ref?: string;

  /** join 模式，默认 inner */
  type?: 'INNER' | 'LEFT' | 'RIGHT' | string;

  /** 输出别名，默认 {joinModel.name}， 可以使用 -> 命名空间 */
  as?: string;

  /** join 结果是否转为列表 */
  asList?: boolean;

  /** 覆盖默认 ON 查询 */
  on?: { [key: string]: any };

  /** 追加 ON 查询 */
  where?: { [key: string]: any };
}

export interface DefinedJoinOption<T extends Model> extends JoinOption {
  /**
   * 模型名称
   */
  model: ModelClass<T>;
}

/**
 * 关系表多条查询设置
 */
export interface ManyOption {
  /** many 表外键 */
  fk?: string;

  /** 来源表引用键，默认为主键, 在JOIN结果中可使用.命名空间，例如 user.id */
  ref?: string;

  /** 输出别名, 可以使用 -> 命名空间 */
  as?: string;

  /** 需要的结果列 */
  columns?: ColumnList;

  /** 是否使用并行查询 */
  parallel?: boolean;
}

/**
 * 模型设置
 */
export interface ModelOption {
  /**
   * 主键名
   * @default 'id'
   */
  pk?: string;

  /** 模型名，默认表名，关联关系中不可重复 */
  name?: string;

  /** 表名，默认取自 name */
  table?: string;

  /** 默认排序，不设置则不排序 */
  order?: string[];

  /** 预定义 join 配置项 */
  join?: { [as: string]: DefinedJoinOption };

  /** 预定义 many 配置项 */
  many?: { [as: string]: ManyOption };
}

/**
 * 分页参数
 */
export interface PageOption {
  /** 分页条数 */
  limit: number;

  /** 分页位置 */
  offset?: number;

  /** 排序 */
  order?: string | string[];
}

/**
 * 数据库驱动必须实现的方法
 */
export interface Query {
  query(arg0: string | ((builder: Builder) => void)): Promise<any>;
}
