export enum SercargoParcelAction {
  ParcelsForUser = 500,
}

export enum SercargoParcelsForUserSubAction {
  InTransit = 0,
  Delivered = 1,
}

export enum SercargoParcelsForUserOptions {
  Last3Months = 1,
  All = 2,
}

export enum SercargoParceslsForUserDeliveredOptions {
  DELIVERED = 3,
  NOT_DELIVERED = 1,
}

export default interface SercargoRequestData {
  /** Action to do in the request */
  a: SercargoParcelAction;
  /** Token for the user */
  t: string;
  /** Locker number linked to the user */
  i: number;
    /** Sub action to be done in the page, for in transit set to 0 */
  p: SercargoParcelsForUserSubAction;
  /** When using with delivered parces, this should be set to 3, when in trasit it should be 1 */
  e: SercargoParceslsForUserDeliveredOptions;
  /** Optons for Time length, for last 3 months set 1, for all set 2 */
  o: SercargoParcelsForUserOptions;
  fd: string | null;
  fh: string | null;
}
