import FetchServiceInstance from "./services/fetch.service";
import db from "./database";

import InTransitParcel from "./models/InTransitParcels.model";
import dayjs from "dayjs";
import ParcelUpdatedResponse from "./models/ParcelUpdatedResponse.model";
import telegramBotService from "./services/telegramBot.service";

const INTERVAL_MS = 10000;

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

    const sercargoParcels =
      await FetchServiceInstance.sercargoFetchInTransitParcels();

    console.log(`Fetched ${sercargoParcels.length} parcels`);

    console.log(`## Processing parcels and saving into database if new`);
    init(sercargoParcels);

    console.log(`## Checking for changes in existing parcels`);
    const changes = await checkChanges(sercargoParcels);

    if (changes.isChanged) {
      console.log("Changes detected");
      console.log(JSON.stringify(changes, null, 2));

      console.log(`Sending message to telegram`);
      await telegramBotService.sendMessage(
        `Changes detected for guides\n${JSON.stringify(changes, null, 2)}`
      );
    } else {
      console.log("No changes detected");
    }

    console.log(`Task finished at ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
    console.log(
      `Task completed successfully, rerunning in ${INTERVAL_MS / 1000} seconds`
    );
    console.log("=".repeat(50));
  } catch (error) {
    console.error(`Task failed with error: ${error}`);
  }
}

async function main() {
  await telegramBotService.sendMessage("Bot started");
  runTask();

  const interval = setInterval(runTask, INTERVAL_MS);

  const shutdownSignals = ["SIGINT", "SIGTERM", "SIGQUIT"];
  for (const signal of shutdownSignals) {
    process.on(signal, async () => {
      clearInterval(interval);
      console.log(`Received signal ${signal}, shutting down`);
      await telegramBotService.sendMessage("Bot shutting down");
      process.exit(0);
    });
  }
}

main();
