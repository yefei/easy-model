'use strict';

const { UserQuery } = require('../_dist/models');

module.exports = {
  join: {
    user: { model: UserQuery },
  },
};
