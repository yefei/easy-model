import { model } from '../../dist';
import { NonautopkTable } from './_tables';

@model({
  pk: 'id',
  table: 'nonautopk',
})
export default class Nonautopk extends NonautopkTable {
}
