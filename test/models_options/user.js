export default {
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
    profile: { model: 'profile', fk: 'id', ref: 'user_id' },
    messages: { model: 'message', fk: 'id', ref: 'user_id', asList: true },
  },
  many: {
    messageList: { model: 'message' },
  },
};
