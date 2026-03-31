import { config } from "../config";
import { ErrorLogType } from "../models/ErrorLogs.model";
import InTransitParcel, {
  InTransitParcelInvoiceStatus,
} from "../models/InTransitParcels.model";
import {
  SercargoWrsParcel,
  SercargoWrsParcelDetail,
} from "../models/SercargoWrs.model";
import errorLogger from "./log.service";

interface FetchSuccess<T> {
  ok: true;
  data: T;
}

interface FetchFailure {
  ok: false;
  error: string;
}

type FetchResult<T> = FetchSuccess<T> | FetchFailure;

class FetchService {
  private readonly requestTimeoutMs = 10000;
  private readonly maxRetries = 2;
  private sercargoURL = "https://app.sercargologistics.com/v4/api/wrs";

  private sercargoInitArgs: RequestInit = {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.SERCARGO_API_TOKEN}`,
    },
  };

  private async fetchWithRetry<T>(
    url: string,
    init?: RequestInit
  ): Promise<FetchResult<T>> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = `Fetch failed with status ${response.status}`;

          if (response.status >= 500 && attempt < this.maxRetries) {
            continue;
          }

          return { ok: false, error };
        }

        const data = (await response.json()) as T;
        return { ok: true, data };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown fetch error";

        if (attempt === this.maxRetries) {
          return { ok: false, error: errorMessage };
        }
      } finally {
        clearTimeout(timeout);
      }

      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 500));
    }

    return { ok: false, error: "Request failed after retries" };
  }

  private formatCurrency(amount: string | null): string {
    const parsedAmount = Number.parseFloat(amount ?? "");

    if (Number.isNaN(parsedAmount)) {
      return amount ?? "0";
    }

    return `L ${parsedAmount.toFixed(2)}`;
  }

  private normalizeParcel(parcel: SercargoWrsParcel): InTransitParcel {
    const totalAmount = parcel.total_lps_isv ?? parcel.total_lps ?? "0";

    return {
      pcode: 0,
      pmsg: "OK",
      pcid: parcel.id,
      fecha: parcel.fecha,
      probable:
        parcel.delivery_date ??
        parcel.available_date ??
        parcel.fecha_probable_entrega ??
        "",
      tfactura:
        parcel.tiene_factura === "SI"
          ? InTransitParcelInvoiceStatus.YES
          : InTransitParcelInvoiceStatus.NO,
      btnfactura:
        parcel.factura_id !== null && parcel.factura_id !== undefined
          ? String(parcel.factura_id)
          : "",
      estado: parcel.estado,
      estadocolor: parcel.estatus,
      guia: String(parcel.numero),
      tracking: parcel.track_number,
      tracking_add: parcel.tracking_adicinales ?? "",
      proveedor: parcel.customer_notes ?? parcel.ref1,
      items: String(parcel.total_items),
      tiposerv: parcel.service,
      tipo: parcel.service.replace(/\s+/g, " ").trim(),
      peso: parcel.peso,
      total: this.formatCurrency(totalAmount),
      total_monto: totalAmount,
      rid: String(parcel.id),
    };
  }

  public async sercargoFetchInTransitParcels(): Promise<
    FetchResult<InTransitParcel[]>
  > {
    const response = await this.fetchWithRetry<SercargoWrsParcel[]>(
      `${this.sercargoURL}/detail?option=1`,
      this.sercargoInitArgs
    );

    if (!response.ok) {
      errorLogger.log(
        `Error while fetching sercargo parcels ${response.error}`,
        ErrorLogType.ERROR
      );
      return response;
    }

    return {
      ok: true,
      data: response.data.map((parcel) => this.normalizeParcel(parcel)),
    };
  }

  public async sercargoFetchParcelDetails(
    parcelId: number
  ): Promise<FetchResult<SercargoWrsParcelDetail>> {
    const response = await this.fetchWithRetry<SercargoWrsParcelDetail>(
      `${this.sercargoURL}/${parcelId}`,
      this.sercargoInitArgs
    );

    if (!response.ok) {
      errorLogger.log(
        `Error while fetching sercargo parcel ${parcelId}: ${response.error}`,
        ErrorLogType.ERROR
      );
    }

    return response;
  }
}

const FetchServiceInstance = new FetchService();

export default FetchServiceInstance;
