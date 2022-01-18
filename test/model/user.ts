import { data, join, many, model } from '../../src';
import { UserTable } from './_tables';
import Message from './message';
import Profile from './profile';

@model({
  pk: 'id',
  table: 'user',
})
export default class User extends UserTable {
  @join(Profile, { type: 'OneToMany', asList: false })
  profile?: Profile;

  @join(Message)
  messages?: Message[];

  @many(Message)
  messageList?: Message[];

  @data
  get age() {
    return this.birthday ? (new Date().getFullYear()) - this.birthday.getFullYear() : undefined;
  }

  set age(v) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - v, 1, 1);
    this.birthday = date;
  }
}
