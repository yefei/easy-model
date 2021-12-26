import { Builder } from "sql-easy-builder";
import { Model } from "./model";
import { Repository } from "./repository";
import { Query } from "./types";

class Q implements Query {
  query(arg0: string | ((builder: Builder) => void)): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

class Profile extends Model {}

class User extends Model {
  id: string;
  name: string;
  profile: Profile;

  get age() {
    return this.birthday ? (new Date().getFullYear()) - this.birthday.getFullYear() : undefined;
  }

  set age(value) {
    this.birthday = `${(new Date().getFullYear()) - value}-1-1`;
  }
}

const repo = new Repository(User, new Q());
const ins = repo.createInstance({});
