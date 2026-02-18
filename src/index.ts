import FetchServiceInstance from "./services/fetch.service";
import db from "./database";

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

async function init(parcels: InTransitParcel[]) {
  if (!parcels.length) {
    return;
  }

  for await (const parcel of parcels) {
    if (!parcel.guia) continue;
    const guideNumber = Number.parseInt(parcel.guia);
    const existingParcel = db.getParcel(guideNumber);

    if (existingParcel) {
      continue;
    }

    db.addParcel({ id: guideNumber, ...parcel });
  }
}

async function checkChanges(
  parcels: InTransitParcel[]
): Promise<ParcelUpdatedResponse> {
  const returningValue: ParcelUpdatedResponse = {
    isChanged: false,
    whatChanged: [],
  };

  if (!parcels.length) {
    return returningValue;
  }

  for await (const parcel of parcels) {
    if (!parcel.guia) continue;
    const guideNumber = Number.parseInt(parcel.guia);
    const existingParcel = db.getParcel(guideNumber);

    if (!existingParcel) {
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

  return returningValue;
}

async function runTask() {
  try {
    // Track previous and current package counts
    const oldParcels = db.getParcels();
    const oldCount = oldParcels.length;
    const sercargoParcels =
      (await FetchServiceInstance.sercargoFetchInTransitParcels()).filter(
        (p) => !!p.guia
      );
    const newCount = sercargoParcels.length;
    if (newCount !== oldCount) {
      const diff = newCount - oldCount;
      const changeSign = diff > 0 ? '+' : '';
      // Determine which GUIDs were added or removed
      let detail = '';
      let removedParcels: typeof oldParcels = [];
      if (diff > 0) {
        const oldGuiaSet = new Set(oldParcels.map(p => p.guia));
        const added = sercargoParcels.filter(p => !oldGuiaSet.has(p.guia)).map(p => p.guia);
        detail = `Added: ${added.join(', ')}`;
      } else {
        const newGuiaSet = new Set(sercargoParcels.map(p => p.guia));
        removedParcels = oldParcels.filter(p => !newGuiaSet.has(p.guia));
        detail = `Removed: ${removedParcels.map(p => p.guia).join(', ')}`;
      }
      const message = `<b>Package count changed</b>\nBefore: ${oldCount}\nAfter: ${newCount}\nChange: ${changeSign}${diff}\n${detail}`;
      await telegramBotService.sendMessage(message);
      await ntfyService.sendMessage(`Package count changed\nBefore: ${oldCount}\nAfter: ${newCount}\nChange: ${changeSign}${diff}\n${detail}`);
      for (const parcel of removedParcels) {
        db.deleteParcel(parcel.id);
      }
    }

    await init(sercargoParcels);

    const changes = await checkChanges(sercargoParcels);

    if (changes.isChanged) {
      await telegramBotService.sendUpdateMessage(changes.whatChanged || []);
      await ntfyService.sendUpdateMessage(changes.whatChanged || []);
    }
  } catch (error) {
    errorLogger.log(`Task failed with error: ${error}`, ErrorLogType.ERROR);
  }
}

async function main() {
  await telegramBotService.sendMessage(`
    <b>Bot started</b>
    Bot started at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}
    `);
  await ntfyService.sendMessage(`Bot started at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
  runTask();
  telegramBotService.listenForCommands();

  const interval = setInterval(runTask, INTERVAL_MS);

  const shutdownSignals = ["SIGINT", "SIGTERM", "SIGQUIT"];
  for (const signal of shutdownSignals) {
    process.on(signal, async () => {
      clearInterval(interval);
      await telegramBotService.sendMessage(`
        <b>Bot stopped</b>
        Bot stopped at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}
        `);
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
