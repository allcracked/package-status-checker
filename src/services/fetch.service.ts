import { config } from "../config";

import InTransitParcel from "../models/InTransitParcels.model";
import SercargoRequestData, {
  SercargoParcelAction,
  SercargoParcelsForUserOptions,
  SercargoParcelsForUserSubAction,
  SercargoParceslsForUserDeliveredOptions,
} from "../models/SercargoRequestData.model";

class FetchService {
  private sercargoURL = "https://app.sercargologistics.com/servidor/";

  private sercargoInitArgs: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
  };

  private async fetch<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }
    return response.json();
  }

  public async sercargoFetchInTransitParcels(): Promise<InTransitParcel[]> {
    try {
      const requestData: SercargoRequestData = {
        a: SercargoParcelAction.ParcelsForUser,
        t: config.SERCARGO_USER_TOKEN,
        i: config.SERCARGO_USER_LOCKER,
        p: SercargoParcelsForUserSubAction.InTransit,
        e: SercargoParceslsForUserDeliveredOptions.NOT_DELIVERED,
        o: SercargoParcelsForUserOptions.Last3Months,
        fd: "",
        fh: "",
      };
      const requestBody = new URLSearchParams(
        Object.entries(requestData).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: String(value),
          }),
          {}
        )
      );

      const response = await this.fetch<InTransitParcel[]>(
        `${this.sercargoURL}app_rastreo.php`,
        {
          ...this.sercargoInitArgs,
          body: requestBody.toString(),
        }
      );

      return response;
    } catch (error) {
      console.error(error);
      return [];
    }
  }
}

const FetchServiceInstance = new FetchService();

export default FetchServiceInstance;
