import { Builder, JsonWhere } from "sql-easy-builder";
import { FINDER, Finder } from "./finder";
import { MODEL, Model, OPTION } from "./model";

/**
 * 数据库结果类型
 */
export type DataValue = any;

/**
 * 数据库查询结果对象
 */
export type DataResult = { [column: string]: DataValue };

/**
 * 数据库列别名
 */
export type ColumnAs = { [column: string]: string };

/**
 * 表下面列名
 */
export type TableColumnList = { [table: string]: string[] };

/**
 * 数据库列名列表
 */
export type ColumnList = (string | TableColumnList | ColumnAs)[];

/**
 * Model class
 */
export interface ModelClass<T extends Model> {
  /**
   * 模型构造器
   */
  new (data: DataResult): T;

  /**
   * 模型设置项
   */
  [OPTION]?: ModelOption;
}

/**
 * 关联关系
 */
export interface RelationOption<J extends Model> {
  /**
   * 模型类
   * 隐含属性
   */
  [MODEL]?: ModelClass<J>;

  /**
   * 使用的外键，默认取 {J.name}_{J.pk}
   */
  fk?: string;

  /**
   * 引用键，默认取 {mainModel.pk}
   */
  ref?: string;

  /**
   * 输出别名，默认 {model.name}， 可以使用 -> 命名空间
   * 在模型预定义无论是否指定都会被强制设置为属性名称
   */
  as?: string;
}

/**
 * 联合查询设置
 */
export interface JoinOption<T extends Model> extends RelationOption<T> {
  /**
   * 来源, 默认取 {model.name}
   */
  from?: string;

  /**
   * join 模式
   * @default 'ManyToOne'
   */
  type?: 'OneToOne' | 'ManyToOne' | 'OneToMany';

  /**
   * 决定 join 的方式
   * 如果 optional=true 则使用 LEFT，否则默认使用 INNER
   */
  optional?: boolean;

  /**
   * 覆盖默认 ON 查询
   */
  on?: JsonWhere;

  /**
   * 追加到 ON 查询
   */
  where?: JsonWhere;

  /**
   * join 结果是否转为列表
   * 在模型预定义中 join 类型会被强制为 false, joins 类型会被强制为 true
   */
  asList?: boolean;
}

export type DefineJoinOption<T extends Model> = JoinOption<T> & { as?: never, asList?: never };

/**
 * 关系表多条查询设置
 */
export interface ManyOption<T extends Model> extends RelationOption<T> {
  /**
   * 查找器
   * 隐含属性
   */
  [FINDER]?: Finder<T>;

  /**
   * 自定义查询规则
   * 默认创建一个新的 finder
   */
  finder?: (finder: Finder<T>) => void;

  /**
   * 自定义查询连接
   * 默认使用主表 query
   */
  query?: Query;

  /**
   * 需要的结果列
   * @default '*'
   */
  columns?: ColumnList;

  /**
   * 是否使用并行查询
   * 作用于 finder 中未指定 limit 时
   * @default false
   */
  parallel?: boolean;
}

/**
 * 预定义 many
 */
export type DefineManyOption<T extends Model> = ManyOption<T> & { as?: never };

/**
 * 模型设置
 */
export interface ModelOption {
  /**
   * 主键名
   * @default 'id'
   */
  pk?: string;

  /**
   * 模型名，默认表名，关联关系中不可重复
   */
  // name?: string;

  /**
   * 表名，默认取自 name
   */
  table?: string;

  /**
   * 默认排序，不设置则不排序
   */
  order?: string[];
}

/**
 * 分页参数
 */
export interface PageOption {
  /**
   * 分页条数
   */
  limit: number;

  /**
   * 分页位置
   */
  offset?: number;

  /**
   * 排序
   */
  order?: string | string[];
}

/**
 * 分页查询返回的结果
 */
export interface PageResult<T extends Model> extends PageOption {
  /**
   * 总条数
   */
  total: number;

  /**
   * 数据结果列表
   */
  list: T[];
}

/**
 * 数据库更新插入删除等操作的返回结果
 */
export interface QueryResult {
  /**
   * 数据库插入返回的主键值
   */
  insertId: number;

  /**
   * 更新产生的影响行数
   */
  affectedRows: number;
}

/**
 * 数据库驱动必须实现的方法
 */
export interface Query {
  query(arg0: string | ((builder: Builder) => void), params?: any): Promise<DataResult[] | DataResult | QueryResult>;
}
