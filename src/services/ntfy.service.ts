import { UpdateParcelProperty } from "../models/ParcelUpdatedResponse.model";
import errorLogger from "./log.service";
import { ErrorLogType } from "../models/ErrorLogs.model";

const NTFY_TOPIC_URL = "https://ntfy.sh/sercargo_pkg_ntfy";

class NtfyService {
  private async publish(title: string, message: string): Promise<void> {
    try {
      const response = await fetch(NTFY_TOPIC_URL, {
        method: "POST",
        headers: {
          Title: title,
          "Content-Type": "text/plain",
        },
        body: message,
      });

      if (!response.ok) {
        errorLogger.log(
          `ntfy publish failed with status ${response.status}`,
          ErrorLogType.ERROR
        );
      }
    } catch (error) {
      errorLogger.log(`Error publishing to ntfy: ${error}`, ErrorLogType.ERROR);
    }
  }

  public async sendMessage(message: string): Promise<void> {
    await this.publish("Sercargo Update", message);
  }

  public async sendUpdateMessage(
    changes: UpdateParcelProperty[]
  ): Promise<void> {
    for (const change of changes) {
      const title = `Status Update – Guide ${change.guideId}`;
      const body =
        `Property: ${change.property}\n` +
        `From: ${change.updatedFrom}\n` +
        `To: ${change.updatedValue}`;
      await this.publish(title, body);
    }
  }
}

const ntfyService = new NtfyService();

export default ntfyService;
