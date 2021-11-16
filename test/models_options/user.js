'use strict';

const { ProfileQuery, MessageQuery } = require('../_dist/models');

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
    profile: { model: ProfileQuery, fk: 'id', ref: 'user_id' },
    messages: { model: MessageQuery, fk: 'id', ref: 'user_id', asList: true },
  },
  many: {
    messageList: { model: MessageQuery },
  },
};
