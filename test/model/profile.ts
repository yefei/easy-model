import { join, model } from '../../dist';
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
