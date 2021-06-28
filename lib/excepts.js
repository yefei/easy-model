'use strict';

class ExtendableError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else { 
      this.stack = (new Error(message)).stack; 
    }
  }
}

class DoesNotExist extends ExtendableError {}

class UndefinedRelationException extends ExtendableError {}

module.exports = {
  ExtendableError,
  DoesNotExist,
  UndefinedRelationException,
};
