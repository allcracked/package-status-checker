import FetchServiceInstance from "./services/fetch.service";
import db from "./database";

import InTransitParcel from "./models/InTransitParcels.model";
import dayjs from "dayjs";
import ParcelUpdatedResponse from "./models/ParcelUpdatedResponse.model";
import telegramBotService from "./services/telegramBot.service";
import errorLogger from "./services/log.service";
import { ErrorLogType } from "./models/ErrorLogs.model";
import http from "http";

const INTERVAL_MS = 60 * 1000;
const PORT = Number(process.env.PORT) || 3000;

async function init(parcels: InTransitParcel[]) {
  if (!parcels.length) {
    console.log("No parcels to process");
    return;
  }

  for await (const parcel of parcels) {
    console.log(`Checking if parcel with guia ${parcel.guia} exists`);
    const guideNumber = Number.parseInt(parcel.guia);
    const existingParcel = db.getParcel(guideNumber);

    if (existingParcel) {
      console.log(`Parcel with guia ${parcel.guia} already exists`);
      continue;
    }

    console.log(`creating parcel ${parcel.guia}`);

    const createParcel = db.addParcel({ id: guideNumber, ...parcel });
    console.log({ createParcel });
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
    console.log("No parcels to process");
    return returningValue;
  }

  for await (const parcel of parcels) {
    console.log(`Checking if parcel with guia ${parcel.guia} exists`);
    const guideNumber = Number.parseInt(parcel.guia);
    const existingParcel = db.getParcel(guideNumber);

    if (!existingParcel) {
      console.log(`Parcel with guia ${parcel.guia} does not exist`);
      continue;
    }

    console.log(`Checking for changes in parcel ${parcel.guia}`);

    if (existingParcel.estado !== parcel.estado) {
      const currentTimestamp = dayjs().unix();

      console.log(`)Parcel ${parcel.guia} has changed status`);

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

      console.log(`Parcel ${parcel.guia} has changed total_monto`);

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
    console.log(`Task started at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
    console.log(`## Fetching parcels from sercargo`);

    // Track previous and current package counts
    const oldParcels = db.getParcels();
    const oldCount = oldParcels.length;
    const sercargoParcels =
      await FetchServiceInstance.sercargoFetchInTransitParcels();
    const newCount = sercargoParcels.length;
    if (newCount !== oldCount) {
      const diff = newCount - oldCount;
      const changeSign = diff > 0 ? '+' : '';
      // Determine which GUIDs were added or removed
      const oldGuids = oldParcels.map(p => p.guia);
      const newGuids = sercargoParcels.map(p => p.guia);
      let detail = '';
      if (diff > 0) {
        const added = newGuids.filter(g => !oldGuids.includes(g));
        detail = `Added: ${added.join(', ')}`;
      } else {
        const removed = oldGuids.filter(g => !newGuids.includes(g));
        detail = `Removed: ${removed.join(', ')}`;
      }
      const message = `<b>Package count changed</b>\nBefore: ${oldCount}\nAfter: ${newCount}\nChange: ${changeSign}${diff}\n${detail}`;
      await telegramBotService.sendMessage(message);
    }
    console.log(`Fetched ${sercargoParcels.length} parcels`);

    console.log(`## Processing parcels and saving into database if new`);
    init(sercargoParcels);

    console.log(`## Checking for changes in existing parcels`);
    const changes = await checkChanges(sercargoParcels);

    if (changes.isChanged) {
      console.log("Changes detected");
      console.log(JSON.stringify(changes, null, 2));

      console.log(`Sending message to telegram`);
      await telegramBotService.sendUpdateMessage(changes.whatChanged || []);
    } else {
      console.log("No changes detected");
    }

    console.log(`Task finished at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
    console.log(
      `Task completed successfully, rerunning in ${INTERVAL_MS / 1000} seconds`
    );
    console.log("=".repeat(50));
  } catch (error) {
    errorLogger.log(`Task failed with error: ${error}`, ErrorLogType.ERROR);
  }
}

async function main() {
  await telegramBotService.sendMessage(`
    <b>Bot started</b>
    Bot started at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}
    `);
  runTask();
  telegramBotService.listenForCommands();

  const interval = setInterval(runTask, INTERVAL_MS);

  const shutdownSignals = ["SIGINT", "SIGTERM", "SIGQUIT"];
  for (const signal of shutdownSignals) {
    process.on(signal, async () => {
      clearInterval(interval);
      console.log(`Received signal ${signal}, shutting down`);
      await telegramBotService.sendMessage(`
        <b>Bot stopped</b>
        Bot stopped at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}
        `);
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
