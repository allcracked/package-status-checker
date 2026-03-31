import { UpdateParcelProperty } from "../models/ParcelUpdatedResponse.model";
import errorLogger from "./log.service";
import { ErrorLogType } from "../models/ErrorLogs.model";

const NTFY_TOPIC_URL = "https://ntfy.sh/sercargo_pkg_ntfy";
const REQUEST_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

class NtfyService {
  private groupChangesByGuide(changes: UpdateParcelProperty[]) {
    return changes.reduce<Record<string, UpdateParcelProperty[]>>((acc, change) => {
      if (!acc[change.guideId]) {
        acc[change.guideId] = [];
      }

      acc[change.guideId].push(change);
      return acc;
    }, {});
  }

  private async publish(title: string, message: string): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(NTFY_TOPIC_URL, {
          method: "POST",
          headers: {
            Title: title,
            "Content-Type": "text/plain",
          },
          body: message,
          signal: controller.signal,
        });

        if (response.ok) {
          return;
        }

        if (response.status < 500 || attempt === MAX_RETRIES) {
          errorLogger.log(
            `ntfy publish failed with status ${response.status}`,
            ErrorLogType.ERROR
          );
          return;
        }
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          errorLogger.log(`Error publishing to ntfy: ${error}`, ErrorLogType.ERROR);
          return;
        }
      } finally {
        clearTimeout(timeout);
      }

      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 500));
    }
  }

  public async sendMessage(message: string): Promise<void> {
    await this.publish("Sercargo Update", message);
  }

  public async sendUpdateMessage(
    changes: UpdateParcelProperty[]
  ): Promise<void> {
    const changesByGuide = this.groupChangesByGuide(changes);

    for (const [guideId, guideChanges] of Object.entries(changesByGuide)) {
      const title = `Package Update – Guide ${guideId}`;
      const body = guideChanges
        .map(
          (change) =>
            `${change.property}: ${change.updatedFrom} -> ${change.updatedValue}`
        )
        .join("\n");
      await this.publish(title, body);
    }
  }
}

const ntfyService = new NtfyService();

export default ntfyService;
