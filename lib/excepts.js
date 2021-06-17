'use strict';

class DoesNotExist extends Error {}

class UndefinedRelationException extends Error {}

module.exports = {
  DoesNotExist,
  UndefinedRelationException,
};
