import { Instance } from '../src/index';


class User extends Instance {
  birthday: Date;

  get age() {
    return this.birthday ? (new Date().getFullYear()) - this.birthday.getFullYear() : undefined;
  }

  set age(value) {
    this.birthday = `${(new Date().getFullYear()) - value}-1-1`;
  }
}
