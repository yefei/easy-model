import { model } from '../../dist';
import { MessageTable } from './_tables';

@model({
  pk: 'id',
  table: 'message',
  order: ['-id'],
})
export default class Message extends MessageTable {
}
