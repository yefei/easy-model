import { model } from '../../src';
import { ProfileTable } from './_tables';

@model({
  pk: 'id',
  table: 'profile',
})
export default class Profile extends ProfileTable {
}
