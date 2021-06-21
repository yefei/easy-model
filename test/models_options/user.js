'use strict';

const { Profile, Message } = require('../_dist/models');

module.exports = {
  virtuals: {
    age: {
      get() {
        return this.birthday ? (new Date().getFullYear()) - this.birthday.getFullYear() : undefined;
      },
      set(value) {
        this.birthday = `${(new Date().getFullYear()) - value}-1-1`;
      },
    }
  },
  join: {
    profile: { model: Profile, fk: 'id', ref: 'user_id' },
  },
  many: {
    messageList: { model: Message },
  },
};
