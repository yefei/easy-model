export class ExtendableError extends Error {
  name = this.constructor.name;
}

export class DoesNotExist extends ExtendableError {}

export class UndefinedRelationException extends ExtendableError {}
