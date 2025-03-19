export enum InTransitParcelInvoiceStatus {
  YES = "SI",
  NO = "",
  NN = "NN",
}

export enum InTransitParcelServiceType {
  AIR = "FLETE AEREO",
  SEA = "FLETE MARITIMO",
}

export enum InTransitParcelStatus {
  RECEIVED = "En Bodega de Miami X Enviar a SPS",
  TRANSIT = "Enviado a SPS",
  WAREHOUSE = "Disponible almacén Tegucigalpa",
  DELIVERED = "Entregado a Cliente",
}

export default interface InTransitParcel {
  pcode: number;
  pmsg: string;
  pcid?: number;
  /** This is parseable to a date MM/DD/YYYY */
  fecha: string;
  /** This is parseable to a date MM/DD/YYYY */
  probable: string;
  tfactura: InTransitParcelInvoiceStatus;
  /** Contains query parameters */
  btnfactura: string;
  estado: InTransitParcelStatus;
  estadocolor: string | number;
  /** Parseable to a number */
  guia: string;
  tracking: string;
  tracking_add: string;
  proveedor: string | null;
  /** Parseable to a number */
  items: string;
  tiposerv: string;
  tipo: InTransitParcelServiceType;
  /** Parseable to a number */
  peso: string;
  total: string;
  /** Parseable to a number */
  total_monto: string;
  /** Parseable to a number */
  rid: string;
}
