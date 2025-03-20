import dayjs from "dayjs";
import ErrorLogModel, { ErrorLogType } from "../models/ErrorLogs.model";

class ErrorLogger {
    private logs: ErrorLogModel[] = [];

    constructor() {
        this.log(`Init logs`, ErrorLogType.LOG, false);
    }

    public log(message: string, errorType = ErrorLogType.LOG, showConsole = true) {
        if (showConsole) {
            switch (errorType) {
                case ErrorLogType.LOG:
                    console.log(message);
                    break;
                case ErrorLogType.ERROR:
                    console.error(message);
                    break;
                case ErrorLogType.WARN:
                    console.warn(message);
                    break;
                default:
                    console.log(message);
                    break;
            }
        }

        this.logs.push({ message, type: errorType, time: dayjs().format("YYYY-MM-DD HH:mm:ss") });
    }

    public getLogs(): ErrorLogModel[] {
        try {
            return this.logs;
        } catch (error) {
            this.log(`Error while getting logs: ${error}`, ErrorLogType.ERROR);
            return [];
        }
    }
}

const errorLogger = new ErrorLogger();

export default errorLogger;