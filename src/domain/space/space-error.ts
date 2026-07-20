/** Space input the model refuses — an invalid id, or a name it will not accept. */
export class SpaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpaceValidationError";
  }
}
