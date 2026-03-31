import FetchServiceInstance from "./services/fetch.service";
import db from "./database";
import { config } from "./config";

import InTransitParcel from "./models/InTransitParcels.model";
import dayjs from "dayjs";
import ParcelUpdatedResponse from "./models/ParcelUpdatedResponse.model";
import telegramBotService from "./services/telegramBot.service";
import ntfyService from "./services/ntfy.service";
import errorLogger from "./services/log.service";
import { ErrorLogType } from "./models/ErrorLogs.model";
import http from "http";

const INTERVAL_MS = 60 * 1000;
const PORT = Number(process.env.PORT) || 3000;
let nextRunTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;
let shutdownNotificationSent = false;

function getGuideNumber(parcel: Pick<InTransitParcel, "guia">): number | null {
  if (!parcel.guia) {
    return null;
  }

  const guideNumber = Number.parseInt(parcel.guia, 10);
  return Number.isNaN(guideNumber) ? null : guideNumber;
}

function buildParcelMap<T extends Pick<InTransitParcel, "guia">>(
  parcels: T[]
): Map<number, T> {
  return parcels.reduce((acc, parcel) => {
    const guideNumber = getGuideNumber(parcel);
    if (guideNumber !== null) {
      acc.set(guideNumber, parcel);
    }

    return acc;
  }, new Map<number, T>());
}

function syncParcels(
  parcels: InTransitParcel[]
): ParcelUpdatedResponse {
  const returningValue: ParcelUpdatedResponse = {
    isChanged: false,
    whatChanged: [],
  };

  const existingParcels = db.getParcels();
  const existingParcelsByGuide = buildParcelMap(existingParcels);
  const currentParcelsByGuide = buildParcelMap(parcels);

  for (const parcel of parcels) {
    const guideNumber = getGuideNumber(parcel);
    if (guideNumber === null) continue;
    const existingParcel = existingParcelsByGuide.get(guideNumber);

    if (!existingParcel) {
      db.addParcel({ id: guideNumber, ...parcel });
      continue;
    }

    if (existingParcel.estado !== parcel.estado) {
      const currentTimestamp = dayjs().unix();

      db.addChange({
        guia: existingParcel.guia,
        changedKey: "estado",
        changedValue: existingParcel.estado,
        changedTo: parcel.estado,
        changedAt: currentTimestamp,
      });

      db.updateParcel(guideNumber, { estado: parcel.estado });

      returningValue.isChanged = true;
      returningValue.whatChanged?.push({
        guideId: parcel.guia,
        property: "estado",
        updatedValue: parcel.estado,
        updatedAt: currentTimestamp,
        updatedFrom: existingParcel.estado,
      });
    }

    if (existingParcel.total_monto !== parcel.total_monto) {
      const currentTimestamp = dayjs().unix();

      db.addChange({
        guia: existingParcel.guia,
        changedKey: "total_monto",
        changedValue: existingParcel.total_monto,
        changedTo: parcel.total_monto,
        changedAt: currentTimestamp,
      });

      db.updateParcel(guideNumber, { total_monto: parcel.total_monto });

      returningValue.isChanged = true;
      returningValue.whatChanged?.push({
        guideId: parcel.guia,
        property: "total_monto",
        updatedValue: parcel.total_monto,
        updatedAt: currentTimestamp,
        updatedFrom: existingParcel.total_monto,
      });
    }
  }

  for (const existingParcel of existingParcels) {
    const guideNumber = getGuideNumber(existingParcel);
    if (guideNumber === null) continue;

    if (!currentParcelsByGuide.has(guideNumber)) {
      db.deleteParcel(guideNumber);
    }
  }

  return returningValue;
}

async function runTask() {
  try {
    const oldParcels = db.getParcels();
    const oldCount = oldParcels.length;
    const parcelResult = await FetchServiceInstance.sercargoFetchInTransitParcels();

    if (!parcelResult.ok) {
      errorLogger.log(
        `Skipping sync because Sercargo fetch failed: ${parcelResult.error}`,
        ErrorLogType.WARN
      );
      return;
    }

    const sercargoParcels = parcelResult.data.filter((p) => !!p.guia);
    const newCount = sercargoParcels.length;

    if (newCount !== oldCount) {
      const diff = newCount - oldCount;
      const changeSign = diff > 0 ? '+' : '';
      let detail = '';
      const oldGuiaSet = new Set(oldParcels.map(p => p.guia));
      const newGuiaSet = new Set(sercargoParcels.map(p => p.guia));

      if (diff > 0) {
        const added = sercargoParcels.filter(p => !oldGuiaSet.has(p.guia)).map(p => p.guia);
        detail = `Added: ${added.join(', ')}`;
      } else {
        const removedParcels = oldParcels.filter(p => !newGuiaSet.has(p.guia));
        detail = `Removed: ${removedParcels.map(p => p.guia).join(', ')}`;
      }

      const message = `<b>Package count changed</b>\nBefore: ${oldCount}\nAfter: ${newCount}\nChange: ${changeSign}${diff}\n${detail}`;
      await telegramBotService.sendMessage(message, undefined, "HTML");
      await ntfyService.sendMessage(`Package count changed\nBefore: ${oldCount}\nAfter: ${newCount}\nChange: ${changeSign}${diff}\n${detail}`);
    }

    const changes = syncParcels(sercargoParcels);

    if (changes.isChanged) {
      await telegramBotService.sendUpdateMessage(changes.whatChanged || []);
      await ntfyService.sendUpdateMessage(changes.whatChanged || []);
    }
  } catch (error) {
    errorLogger.log(`Task failed with error: ${error}`, ErrorLogType.ERROR);
  }
}

function scheduleNextRun() {
  if (isShuttingDown) {
    return;
  }

  nextRunTimer = setTimeout(async () => {
    await runTask();
    scheduleNextRun();
  }, INTERVAL_MS);
}

async function main() {
  await telegramBotService.sendMessage(`
    <b>Bot started</b>
    Bot started at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}
    `, undefined, "HTML");
  await ntfyService.sendMessage(`Bot started at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
  await runTask();
  if (config.TELEGRAM_POLLING_ENABLED) {
    telegramBotService.listenForCommands();
  }

  scheduleNextRun();

  const shutdownSignals = ["SIGINT", "SIGTERM", "SIGQUIT"];
  for (const signal of shutdownSignals) {
    process.on(signal, async () => {
      if (shutdownNotificationSent) {
        return;
      }

      shutdownNotificationSent = true;
      isShuttingDown = true;
      if (nextRunTimer) {
        clearTimeout(nextRunTimer);
      }
      await telegramBotService.sendMessage(`
        <b>Bot stopped</b>
        Bot stopped at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}
        `, undefined, "HTML");
      await ntfyService.sendMessage(`Bot stopped at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
      process.exit(0);
    });
  }
}

main();

// Health-check server
http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});
