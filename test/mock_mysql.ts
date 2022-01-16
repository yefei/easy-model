import { format, escape, escapeId } from 'sqlstring';
import Debug from 'debug';
import { EventEmitter } from 'events';

const debug = Debug('mysql-mock');

function nextCallback(func: Function, ...args: any[]) {
  func && process.nextTick(func, ...args);
}

export class MockConnection extends EventEmitter {
  config: any;
  authorized: boolean;
  threadId: number = 1;
  private _mockData: { [key: string]: any } = {};

  setMockData(sql: string, values?: any, data?: any) {
    this._mockData[format(sql, values)] = data;
  }

  execute(options: any, values?: any, callback?: any): any {
    const sql = typeof options === 'string' ? format(options, values) : format(options.sql, options.values);
    debug('execute:', sql);
    nextCallback(callback, null, this._mockData[sql]);
  }

  ping(callback?: (err: any) => any): void {
    debug('ping');
    nextCallback(callback, null);
  }

  promise(promiseImpl?: any): any {
    throw new Error('Method not implemented.');
  }

  beginTransaction(callback: (err: any) => void): void {
    debug('beginTransaction');
    nextCallback(callback, null);
  }

  connect(callback?: (err: any) => void): void {
    debug('connect');
    nextCallback(callback, null);
  }

  commit(callback?: (err: any) => void): void {
    debug('commit');
    nextCallback(callback, null);
  }

  changeUser(options: any, callback?: (err: any) => void): void {
    throw new Error('Method not implemented.');
  }

  query(options: any, values?: any, callback?: any): any {
    const sql = typeof options === 'string' ? format(options, values) : format(options.sql, options.values);
    debug('query:', sql);
    nextCallback(typeof values === 'function' ? values : callback, null, this._mockData[sql]);
  }
  
  end(options?: any, callback?: any): void {
    debug('end');
    nextCallback(callback, null);
  }

  destroy(): void {
    debug('destroy');
  }

  pause(): void {
    debug('pause');
  }

  resume(): void {
    debug('resume');
  }

  escape(value: any): string {
    return escape(value);
  }

  escapeId(values: any): string {
    return escapeId(values);
  }

  format(sql: string, values?: any): string {
    return format(sql, values);
  }

  rollback(callback: () => void): void {
    debug('rollback');
    nextCallback(callback, null);
  }
}
