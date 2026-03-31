export interface SercargoWrsParcel {
  id: number;
  fecha: string;
  numero: number;
  dispatch_date: string | null;
  total_items: number;
  track_number: string;
  tracking_adicinales: string | null;
  ref1: string | null;
  total_lps: string | null;
  total_lps_isv: string | null;
  tienda: number;
  service: string;
  estatus: number;
  peso: string;
  canal_id: number;
  retiro_locker: number;
  days: number;
  rack: string | null;
  manifiesto_tipo_id: number;
  tiene_guia_aparte: string;
  fecha_probable_entrega: string | null;
  tienda_original: number;
  valor_declarado: string | null;
  tiene_factura: string;
  customer_notes: string | null;
  available_date: string | null;
  es_consolidado: string;
  factura_id?: number | null;
  delivery_date: string | null;
  estado: string;
}

export interface SercargoWrsParcelDetail extends SercargoWrsParcel {
  delivered_time: string | null;
  invoice_id: number | null;
}
