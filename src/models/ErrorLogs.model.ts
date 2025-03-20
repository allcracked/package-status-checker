export enum ErrorLogType {
    WARN = 'warning',
    LOG = 'log',
    ERROR = 'error',
}

export default interface ErrorLogModel {
    time: string;
    type: ErrorLogType;
    message: string;
}