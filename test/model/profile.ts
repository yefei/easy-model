import { join, model } from '../../src';
import { ProfileTable } from './_tables';
import User from './user';

@model({
  pk: 'id',
  table: 'profile',
})
export default class Profile extends ProfileTable {
  @join(User)
  user?: User;
}
